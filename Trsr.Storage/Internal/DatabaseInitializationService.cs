using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Trsr.Storage.Internal;

/// <summary>
/// Service that ensures the database is created and migrated on application startup
/// </summary>
internal class DatabaseInitializationService : IHostedService, IDatabaseInitializer
{
        private readonly IServiceProvider serviceProvider;
    private readonly ILogger<DatabaseInitializationService> logger;

    public DatabaseInitializationService(
        IServiceProvider serviceProvider,
        ILogger<DatabaseInitializationService> logger)
    {
        this.serviceProvider = serviceProvider;
        this.logger = logger;
    }

    /// <inheritdoc />
    public async Task EnsureDatabaseReadyAsync(CancellationToken cancellationToken = default)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<StorageDbContext>();
        
        logger.LogInformation("Ensuring database is created and up to date...");
        
        // This will create the database if it doesn't exist and apply any pending migrations
        await context.Database.MigrateAsync(cancellationToken);
        
        logger.LogInformation("Database initialization completed successfully");
    }

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await EnsureDatabaseReadyAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize database");
            throw;
        }
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
        => Task.CompletedTask;

}
