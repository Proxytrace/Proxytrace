using System.Reflection;
using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Demo;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.TestSupport;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Storage.Internal;
using Proxytrace.Storage.Internal.Entities;
using Proxytrace.Storage.Internal.Entities.Project;
using Proxytrace.Storage.Internal.Entities.TestRunSchedule;
using Proxytrace.Storage.Internal.Entities.TestSuite;
using Proxytrace.Storage.Internal.Statistics;

namespace Proxytrace.Storage;

/// <summary>
/// Dependency injection module
/// </summary>
public sealed class Module : Autofac.Module
{
    private readonly Func<IServiceProvider, StorageConfiguration> configurationFactory;
    private readonly bool registerApplicationServices;

    public Module(
        Func<IServiceProvider, StorageConfiguration> configurationFactory,
        bool registerApplicationServices = true)
    {
        this.configurationFactory = configurationFactory;
        this.registerApplicationServices = registerApplicationServices;
    }

    /// <summary>
    /// Add the services for storage
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule<Domain.Module>();

        if (registerApplicationServices)
        {
            // Register DB initializer FIRST so its IHostedService starts before any other
            // hosted service that may query the database on startup (e.g. StatisticsBackfillHostedService).
            builder.RegisterServiceCollection(services =>
            {
                services.AddHostedService<DatabaseInitializationService>();
            });

            builder.RegisterType<DatabaseInitializationService>()
                .As<IDatabaseInitializer>()
                .SingleInstance();

            builder.RegisterModule<Application.Module>();

            // One-time, idempotent backfill that protects pre-retrofit plaintext secrets. Registered
            // after the DB initializer so it runs once migrations have applied. Resolvable as itself so
            // tests can drive it directly.
            builder.RegisterType<SecretsBackfillService>()
                .AsSelf()
                .SingleInstance();
            builder.RegisterServiceCollection(services =>
                services.AddHostedService(sp => sp.GetRequiredService<SecretsBackfillService>()));
        }

        builder.Register<StorageConfiguration>(ct => configurationFactory(ct.Resolve<IServiceProvider>())).SingleInstance();

        builder.Register<DbContextOptions<StorageDbContext>>(ct =>
        {
            var dbBuilder = new DbContextOptionsBuilder<StorageDbContext>();
            ConfigureStorage(dbBuilder, ct.Resolve<StorageConfiguration>());
            return dbBuilder.Options;
        }).SingleInstance();

        builder.RegisterType<StorageDbContext>()
            .AsSelf()
            .InstancePerDependency();

        // Ambient-aware context factory: while a logical transaction is active, every repository,
        // mapper and query resolves the single shared transactional context (read-your-writes on
        // one connection). Outside a transaction it hands out a fresh context per call. This
        // explicit Func<StorageDbContext> registration overrides Autofac's auto-generated one.
        builder.Register<Func<StorageDbContext>>(ct =>
        {
            var scope = ct.Resolve<ILifetimeScope>();
            return () =>
            {
                var ambient = scope.Resolve<AmbientDbContext>();
                return ambient.Context ?? scope.Resolve<StorageDbContext>();
            };
        }).InstancePerLifetimeScope();

        ConfigureEntities(builder);
        ConfigureEntity(typeof(TestSuiteEvaluatorEntity), builder);
        ConfigureEntity(typeof(TestRunScheduleEndpointEntity), builder);
        ConfigureEntity(typeof(ProjectUserEntity), builder);
        ConfigureEntity(typeof(Internal.Entities.TestResult.EvaluationStatEntity), builder);

        builder.RegisterType<AmbientDbContext>()
            .AsSelf()
            .InstancePerLifetimeScope();

        builder.RegisterType<Transaction>()
            .As<ITransaction>();

        builder.RegisterType<TestDataReset>()
            .As<ITestDataReset>()
            .InstancePerDependency();

        builder.RegisterType<TestRunStatsStore>()
            .AsImplementedInterfaces()
            .InstancePerDependency();

        builder.RegisterType<Internal.Entities.Licensing.StoredLicenseStore>()
            .AsImplementedInterfaces()
            .InstancePerDependency();

        builder.RegisterType<Internal.Entities.EmailSettings.EmailSettingsStore>()
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

                // Suppress pending model changes warning across all providers.
                // The snapshot generated by EF Core 10 tools can diverge from the runtime
                // model in metadata-only ways (e.g. explicit Schema=null annotations, Npgsql
                // column type conventions) without actual schema differences. All real schema
                // changes have a corresponding migration; this suppression only hides the
                // cosmetic metadata mismatch that the tools and runtime resolve differently.
                b.Ignore(RelationalEventId.PendingModelChangesWarning);

                // The in-memory provider has no real transactions; silence the warning so the
                // single EF transaction path (used by ITransaction) is a no-op under unit tests.
                if (configuration is InMemoryConfiguration)
                    b.Ignore(InMemoryEventId.TransactionIgnoredWarning);
            });

        switch (configuration)
        {
            case PostgresConfiguration postgres:
                options.UseNpgsql(postgres.ConnectionString,
                    npgsqlOptions =>
                        npgsqlOptions.MigrationsAssembly(typeof(StorageDbContext).Assembly.GetName().Name));
                break;
            case InMemoryConfiguration inMemory:
                options.UseInMemoryDatabase(Guid.NewGuid() + inMemory.Name);
                break;
            default:
                throw new NotSupportedException(
                    $"Storage configuration of type {configuration.GetType().Name} is not supported");
        }
    }
}