using Autofac;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Trsr.Storage;

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

        var storageConfig = connectionString.Contains("host=", StringComparison.OrdinalIgnoreCase)
                         || connectionString.Contains("port=", StringComparison.OrdinalIgnoreCase)
            ? StorageConfiguration.Postgres(connectionString)
            : StorageConfiguration.SqlServer(connectionString);

        var containerBuilder = new ContainerBuilder();
        containerBuilder.RegisterModule(new Module(storageConfig));
        var container = containerBuilder.Build();

        return container.Resolve<StorageDbContext>();
    }
}
