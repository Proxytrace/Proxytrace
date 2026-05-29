using Autofac;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Proxytrace.Storage;

/// <summary>
/// Design-time factory for StorageDbContext, used by EF Core tooling (dotnet ef migrations add, etc.).
/// </summary>
[UsedImplicitly]
internal class StorageDbContextFactory : IDesignTimeDbContextFactory<StorageDbContext>
{
    public StorageDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.development.json", optional: true)
            .Build();

        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Set ConnectionStrings:Default in appsettings.json or appsettings.development.json.");

        // Migrations are PostgreSQL-only. Supply a PostgreSQL connection string at design time,
        // e.g. via the ConnectionStrings__Default environment variable.
        var storageConfig = StorageConfiguration.Postgres(connectionString);

        var containerBuilder = new ContainerBuilder();
        containerBuilder.RegisterModule(new Module(_ => storageConfig));
        containerBuilder.RegisterInstance(NullLoggerFactory.Instance).As<ILoggerFactory>();
        containerBuilder.RegisterGeneric(typeof(NullLogger<>)).As(typeof(ILogger<>));
        var container = containerBuilder.Build();

        return container.Resolve<StorageDbContext>();
    }
}
