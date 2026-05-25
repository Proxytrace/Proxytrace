namespace Proxytrace.Application.Demo;

/// <summary>
/// Service to ensure database is created and migrations are applied
/// </summary>
public interface IDatabaseInitializer
{
    /// <summary>
    /// Ensures the database is created and all migrations are applied
    /// </summary>
    Task EnsureDatabaseReadyAsync(CancellationToken cancellationToken = default);
}

