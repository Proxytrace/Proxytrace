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
    /// <inheritdoc />
    public async Task ExecuteSqlScriptAsync(string sql, CancellationToken cancellationToken = default)
    {
        var statements = sql
            .Split('\n')
            .Where(line => !line.TrimStart().StartsWith("--"))
            .Aggregate(new System.Text.StringBuilder(), (sb, line) => sb.AppendLine(line))
            .ToString()
            .Split(';')
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToArray();

        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<StorageDbContext>();

        foreach (var statement in statements)
        {
            await context.Database.ExecuteSqlRawAsync(statement, cancellationToken);
        }
    }

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
