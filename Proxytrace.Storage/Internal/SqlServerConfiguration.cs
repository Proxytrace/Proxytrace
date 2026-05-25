namespace Proxytrace.Storage.Internal;

/// <summary>
/// Configuration for SQL Server storage
/// </summary>
internal record SqlServerConfiguration : StorageConfiguration
{
    /// <inheritdoc />
    internal override bool SupportsMigrations => true;
    
    /// <summary>
    /// The connection string to the SQL Server database
    /// </summary>
    public required string ConnectionString { get; init; }
}