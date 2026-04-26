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
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<StorageDbContext>();

        foreach (var statement in SplitSqlStatements(sql))
        {
            // EF Core runs String.Format on the SQL to substitute {0}/{1}/… parameter placeholders,
            // so literal braces in JSON column values must be doubled to avoid FormatException.
            var escaped = statement.Replace("{", "{{").Replace("}", "}}");
            await context.Database.ExecuteSqlRawAsync(escaped, cancellationToken);
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

    // Splits a SQL script into individual statements on ';', correctly ignoring
    // semicolons inside single-quoted string literals and '--' line comments.
    private static IEnumerable<string> SplitSqlStatements(string sql)
    {
        var current = new System.Text.StringBuilder();
        bool inString = false;

        for (int i = 0; i < sql.Length; i++)
        {
            char c = sql[i];

            if (inString)
            {
                current.Append(c);
                if (c == '\'')
                {
                    // '' is an escaped single quote inside a string literal, not the end of the string
                    if (i + 1 < sql.Length && sql[i + 1] == '\'')
                        current.Append(sql[++i]);
                    else
                        inString = false;
                }
            }
            else if (c == '\'' )
            {
                inString = true;
                current.Append(c);
            }
            else if (c == '-' && i + 1 < sql.Length && sql[i + 1] == '-')
            {
                // Skip to end of line
                while (i < sql.Length && sql[i] != '\n')
                    i++;
            }
            else if (c == ';')
            {
                var stmt = current.ToString().Trim();
                if (!string.IsNullOrWhiteSpace(stmt))
                    yield return stmt;
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        var last = current.ToString().Trim();
        if (!string.IsNullOrWhiteSpace(last))
            yield return last;
    }
}
