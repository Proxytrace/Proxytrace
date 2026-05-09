using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Application.Demo;

namespace Trsr.Storage.Internal;

/// <summary>
/// Service that ensures the database is created and migrated on application startup
/// </summary>
internal class DatabaseInitializationService : IHostedService, IDatabaseInitializer
{
    private readonly IServiceProvider serviceProvider;
    private readonly StorageConfiguration configuration;
    private readonly ILogger<DatabaseInitializationService> logger;

    public DatabaseInitializationService(
        IServiceProvider serviceProvider,
        StorageConfiguration configuration,
        ILogger<DatabaseInitializationService> logger)
    {
        this.serviceProvider = serviceProvider;
        this.configuration = configuration;
        this.logger = logger;
    }

    /// <inheritdoc />
    public async Task EnsureDatabaseReadyAsync(CancellationToken cancellationToken = default)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<StorageDbContext>();

        if (configuration is SqliteConfiguration)
        {
            await ResetLegacySqliteDatabaseAsync(context, cancellationToken);
        }

        logger.LogInformation("Ensuring database is created and up to date via migrations...");
        await context.Database.MigrateAsync(cancellationToken);

        logger.LogInformation("Database initialization completed successfully");
    }

    /// <summary>
    /// Legacy SQLite databases were created via <c>EnsureCreatedAsync</c> and have no
    /// <c>__EFMigrationsHistory</c> table. Their schema reflects whatever model existed at
    /// creation time, which cannot be mapped reliably to a known migration ID. Drop all user
    /// tables so <c>MigrateAsync</c> can rebuild the schema from scratch.
    /// </summary>
    private async Task ResetLegacySqliteDatabaseAsync(StorageDbContext context, CancellationToken cancellationToken)
    {
        var historyRepo = context.GetService<IHistoryRepository>();

        if (await historyRepo.ExistsAsync(cancellationToken))
        {
            return;
        }

        var connection = context.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        var tables = new List<string>();
        await using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                tables.Add(reader.GetString(0));
            }
        }

        if (tables.Count == 0)
        {
            // Fresh DB — let MigrateAsync handle everything.
            return;
        }

        logger.LogWarning(
            "Legacy SQLite database detected (no migrations history). Dropping {Count} table(s) so migrations can rebuild the schema. Local data will be lost.",
            tables.Count);

        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF", cancellationToken);
        try
        {
            foreach (var table in tables)
            {
                var quoted = "\"" + table.Replace("\"", "\"\"") + "\"";
                var sql = "DROP TABLE IF EXISTS " + quoted;
                await context.Database.ExecuteSqlRawAsync(sql, cancellationToken);
            }
        }
        finally
        {
            await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON", cancellationToken);
        }
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
