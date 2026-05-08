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
            await BootstrapLegacySqliteHistoryAsync(context, cancellationToken);
        }

        logger.LogInformation("Ensuring database is created and up to date via migrations...");
        await context.Database.MigrateAsync(cancellationToken);

        logger.LogInformation("Database initialization completed successfully");
    }

    /// <summary>
    /// Legacy SQLite databases were created via <c>EnsureCreatedAsync</c> and have no
    /// <c>__EFMigrationsHistory</c> table. Detect that case and seed history with all known
    /// migration IDs so that <c>MigrateAsync</c> applies only future migrations instead of
    /// re-running everything from scratch (which would fail because the tables already exist).
    /// </summary>
    private async Task BootstrapLegacySqliteHistoryAsync(StorageDbContext context, CancellationToken cancellationToken)
    {
        var historyRepo = context.GetService<IHistoryRepository>();

        if (await historyRepo.ExistsAsync(cancellationToken))
        {
            return;
        }

        // History table missing. Check whether this is a fresh DB (no user tables) or a legacy
        // EnsureCreated DB (user tables present but never tracked migrations).
        var connection = context.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1";
            var anyTable = await cmd.ExecuteScalarAsync(cancellationToken);
            if (anyTable is null)
            {
                // Fresh DB — let MigrateAsync handle everything.
                return;
            }
        }

        logger.LogInformation("Legacy SQLite database detected (no migrations history). Seeding history with all known migrations...");

        await context.Database.ExecuteSqlRawAsync(historyRepo.GetCreateScript(), cancellationToken);

        var migrationsAssembly = context.GetService<IMigrationsAssembly>();
        var productVersion = typeof(DbContext).Assembly.GetName().Version?.ToString() ?? "0.0.0";

        foreach (var migrationId in migrationsAssembly.Migrations.Keys)
        {
            var insertSql = historyRepo.GetInsertScript(new HistoryRow(migrationId, productVersion));
            await context.Database.ExecuteSqlRawAsync(insertSql, cancellationToken);
        }

        logger.LogInformation("Seeded {Count} migration(s) into history.", migrationsAssembly.Migrations.Count);
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
