namespace Trsr.Storage;

/// <summary>
/// Service to ensure database is created and migrations are applied
/// </summary>
public interface IDatabaseInitializer
{
    /// <summary>
    /// Ensures the database is created and all migrations are applied
    /// </summary>
    Task EnsureDatabaseReadyAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes a SQL script, splitting it into individual statements and running each one.
    /// </summary>
    Task ExecuteSqlScriptAsync(string sql, CancellationToken cancellationToken = default);
}

