using Autofac;
using Autofac.Extensions.DependencyInjection;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Trsr.Storage;

/// <summary>
/// Design-time factory for StorageDbContext
/// </summary>
[UsedImplicitly]
internal class StorageDbContextFactory : IDesignTimeDbContextFactory<StorageDbContext>
{
    private readonly IServiceProvider services;

    public StorageDbContextFactory()
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();
        
        string connectionString = configuration.GetConnectionString("MigrationDatabase") 
            ?? throw new InvalidOperationException("MigrationDatabase connection string not configured");
        
        ContainerBuilder containerBuilder = new ContainerBuilder();
        containerBuilder.RegisterModule(new Module(StorageConfiguration.SqlServer(connectionString)));
        services = new AutofacServiceProvider(containerBuilder.Build());
    }
    
    /// <inheritdoc />
    public StorageDbContext CreateDbContext(string[] args) 
        => services.GetRequiredService<StorageDbContext>();
}