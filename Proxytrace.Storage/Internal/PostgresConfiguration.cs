namespace Proxytrace.Storage.Internal;

internal record PostgresConfiguration : StorageConfiguration
{
    internal override bool SupportsMigrations => true;

    public required string ConnectionString { get; init; }
}
