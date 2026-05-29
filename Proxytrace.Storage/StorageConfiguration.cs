using Proxytrace.Storage.Internal;

namespace Proxytrace.Storage;

public abstract record StorageConfiguration
{
    /// <summary>
    /// The cryptography key in base64 format
    /// </summary>
    public string? CryptographyKeyBase64 { get; private init; }
    
    /// <summary>
    /// Whether the storage supports migrations
    /// </summary>
    internal abstract bool SupportsMigrations { get; }

    /// <summary>
    /// When true, the schema is created from the current EF model via <c>EnsureCreatedAsync</c>
    /// instead of applying migrations, even on a migration-capable provider. Intended for
    /// ephemeral environments (e.g. the e2e stack) whose migration history is not authoritative.
    /// </summary>
    public bool UseEnsureCreated { get; init; }

    /// <summary>
    /// Creates a configuration for in-memory storage
    /// </summary>
    public static StorageConfiguration InMemory()
        => new InMemoryConfiguration();

    /// <summary>
    /// Creates a configuration for SQL Server storage
    /// </summary>
    public static StorageConfiguration SqlServer(
        string connectionString,
        string? cryptographyKeyBase64 = null,
        bool useEnsureCreated = false)
        => new SqlServerConfiguration
        {
            ConnectionString = connectionString,
            CryptographyKeyBase64 = cryptographyKeyBase64,
            UseEnsureCreated = useEnsureCreated
        };

    /// <summary>
    /// Creates a configuration for PostgreSQL storage
    /// </summary>
    public static StorageConfiguration Postgres(
        string connectionString,
        string? cryptographyKeyBase64 = null,
        bool useEnsureCreated = false)
        => new PostgresConfiguration
        {
            ConnectionString = connectionString,
            CryptographyKeyBase64 = cryptographyKeyBase64,
            UseEnsureCreated = useEnsureCreated
        };

    /// <summary>
    /// Creates a configuration for SQLite storage
    /// </summary>
    public static StorageConfiguration Sqlite(
        string connectionString,
        string? cryptographyKeyBase64 = null)
        => new SqliteConfiguration
        {
            ConnectionString = connectionString,
            CryptographyKeyBase64 = cryptographyKeyBase64
        };
}