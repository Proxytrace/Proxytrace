namespace Proxytrace.Storage.Internal;

/// <summary>
/// Configuration for SQLite storage
/// </summary>
internal record SqliteConfiguration : StorageConfiguration
{
    /// <inheritdoc />
    internal override bool SupportsMigrations => true;
    
    /// <summary>
    /// The connection string to the SQLite database
    /// </summary>
    public required string ConnectionString { get; init; }
}

