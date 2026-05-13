using System.Reflection;
using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Trsr.Application.Demo;
using Trsr.Application.Statistics;
using Trsr.Common.DependencyInjection;
using Trsr.Domain;
using Trsr.Storage.Internal;
using Trsr.Storage.Internal.Entities;
using Trsr.Storage.Internal.Entities.Project;
using Trsr.Storage.Internal.Entities.TestSuite;
using Trsr.Storage.Internal.Statistics;

namespace Trsr.Storage;

/// <summary>
/// Dependency injection module
/// </summary>
public sealed class Module : Autofac.Module
{
    private readonly Func<IServiceProvider, StorageConfiguration> configurationFactory;

    public Module(Func<IServiceProvider, StorageConfiguration> configurationFactory)
    {
        this.configurationFactory = configurationFactory;
    }

    /// <summary>
    /// Add the services for storage
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule<Application.Module>();

        builder.Register<StorageConfiguration>(ct => configurationFactory(ct.Resolve<IServiceProvider>())).SingleInstance();

        builder.RegisterServiceCollection(services =>
        {
            // Register database initialization service
            services.AddHostedService<DatabaseInitializationService>();
        });

        // Register the database initializer interface (accessible even if migrations not supported)
        builder.RegisterType<DatabaseInitializationService>()
            .As<IDatabaseInitializer>()
            .SingleInstance();

        builder.Register<DbContextOptions<StorageDbContext>>(ct =>
        {
            var dbBuilder = new DbContextOptionsBuilder<StorageDbContext>();
            ConfigureStorage(dbBuilder, ct.Resolve<StorageConfiguration>());
            return dbBuilder.Options;
        }).SingleInstance();

        builder.RegisterType<StorageDbContext>()
            .AsSelf()
            .InstancePerDependency();

        ConfigureEntities(builder);
        ConfigureEntity(typeof(TestSuiteEvaluatorEntity), builder);
        ConfigureEntity(typeof(ProjectUserEntity), builder);

        builder.RegisterType<Transaction>()
            .As<ITransaction>();

        builder.RegisterType<TestRunStatsStore>()
            .AsImplementedInterfaces()
            .InstancePerDependency();

        builder.RegisterType<AgentCallStatsQueries>()
            .As<IAgentCallStatsReader>()
            .InstancePerDependency();

        builder.RegisterType<EvaluatorStatsQueries>()
            .As<IEvaluatorStatsReader>()
            .InstancePerDependency();

        builder
            .Register(context => new AutofacServiceProvider(context.Resolve<ILifetimeScope>()))
            .InstancePerLifetimeScope()
            .IfNotRegistered(typeof(IServiceProvider));
    }

    private static void ConfigureEntities(ContainerBuilder builder)
    {
        var entityTypes = typeof(Module).Assembly
            .GetTypes()
            .Where(t => typeof(IEntity).IsAssignableFrom(t) && t is { IsInterface: false, IsAbstract: false })
            .ToList();

        foreach (Type entityType in entityTypes)
        {
            ConfigureEntity(entityType, builder);
        }
    }

    private static void ConfigureEntity(Type storedEntityType, ContainerBuilder builder)
    {
        builder.RegisterType(storedEntityType)
            .AsSelf();

        var configurationBaseType = typeof(AbstractEntityConfiguration<>).MakeGenericType(storedEntityType);

        // find the type that derives from configurationBaseType
        Type configurationType = typeof(Module).Assembly
                                     .GetTypes()
                                     .SingleOrDefault(t => t.IsSubclassOf(configurationBaseType))
                                 ?? throw new InvalidOperationException(
                                     $"No configuration type found for entity type {storedEntityType.Name}");

        builder
            .RegisterType(configurationType)
            .AsImplementedInterfaces()
            .InstancePerLifetimeScope();

        // get the StoredDomainEntity attribute to locate the associated Domain Entity Type
        var domainEntityType = storedEntityType.GetDomainEntityType();
        if (domainEntityType != null)
        {
            var repositoryBaseType = typeof(AbstractRepository<,>).MakeGenericType(domainEntityType, storedEntityType);
            // find the type that derives from repositoryBaseType
            Type repositoryType = typeof(Module).Assembly
                                      .GetTypes()
                                      .SingleOrDefault(t => t.IsSubclassOf(repositoryBaseType))
                                  ?? throw new InvalidOperationException(
                                      $"No repository type found for entity type {storedEntityType.Name}");

            // register repository type as all registered interfaces
            foreach (Type interfaceType in repositoryType.GetInterfaces())
            {
                builder.RegisterType(repositoryType).As(interfaceType);
            }

            // opt-in in-memory cache for slow-changing reference data
            if (storedEntityType.GetCustomAttribute<CacheableAttribute>() != null)
            {
                Type cacheImpl = typeof(EntityCache<>).MakeGenericType(domainEntityType);
                Type cacheInterface = typeof(IEntityCache<>).MakeGenericType(domainEntityType);
                builder.RegisterType(cacheImpl).As(cacheInterface).InstancePerLifetimeScope();
            }
        }
    }

    private static void ConfigureStorage(DbContextOptionsBuilder options, StorageConfiguration configuration)
    {
        options
            .ConfigureWarnings(b =>
            {
                b.Log(
                    (RelationalEventId.ConnectionOpened, LogLevel.Debug),
                    (RelationalEventId.CommandExecuted, LogLevel.Debug),
                    (RelationalEventId.ConnectionClosed, LogLevel.Debug));

                // SQLite doesn't support ambient transactions
                if (configuration is SqliteConfiguration)
                {
                    b.Ignore(RelationalEventId.AmbientTransactionWarning);
                    // Suppress pending model changes warning for SQLite
                    // This occurs because migrations were created for SQL Server/PostgreSQL
                    // and have provider-specific type differences (e.g., timestamp vs datetimeoffset)
                    b.Ignore(RelationalEventId.PendingModelChangesWarning);
                }
            });

        switch (configuration)
        {
            case SqlServerConfiguration sqlServer:
                options.UseSqlServer(sqlServer.ConnectionString,
                    sqlOptions => sqlOptions.MigrationsAssembly(typeof(StorageDbContext).Assembly.GetName().Name));
                break;
            case PostgresConfiguration postgres:
                options.UseNpgsql(postgres.ConnectionString,
                    npgsqlOptions =>
                        npgsqlOptions.MigrationsAssembly(typeof(StorageDbContext).Assembly.GetName().Name));
                break;
            case SqliteConfiguration sqlite:
                options.UseSqlite(NormalizeSqliteConnectionString(sqlite.ConnectionString),
                    sqliteOptions =>
                        sqliteOptions.MigrationsAssembly(typeof(StorageDbContext).Assembly.GetName().Name));
                break;
            case InMemoryConfiguration inMemory:
                options.UseInMemoryDatabase(Guid.NewGuid() + inMemory.Name);
                break;
            default:
                throw new NotSupportedException(
                    $"Storage configuration of type {configuration.GetType().Name} is not supported");
        }
    }

    // Sets a 30s busy_timeout via DefaultTimeout so concurrent writers wait for the
    // page lock instead of failing immediately with SQLITE_BUSY ("database is locked").
    // WAL journal_mode is set once at init in DatabaseInitializationService.
    private static string NormalizeSqliteConnectionString(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString)
        {
            DefaultTimeout = 30,
            Pooling = true,
        };
        return builder.ToString();
    }
}