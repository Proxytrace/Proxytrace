namespace Proxytrace.Messaging;

public enum MessagingProvider
{
    /// <summary>In-memory channel. Single process only — used by the test suite and local runs.</summary>
    InProcess,

    /// <summary>Redis Streams. Used for the proxy/app split deployment.</summary>
    Redis,
}

public sealed record MessagingConfiguration
{
    public MessagingProvider Provider { get; init; } = MessagingProvider.InProcess;

    public string RedisConnectionString { get; init; } = "localhost:6379";

    public string Stream { get; init; } = "proxytrace:ingest";

    public string ConsumerGroup { get; init; } = "proxytrace-app";

    /// <summary>Per-instance consumer name within the group; defaults to the machine name.</summary>
    public string ConsumerName { get; init; } = Environment.MachineName;

    /// <summary>Idle time after which a pending entry from a dead consumer is reclaimed.</summary>
    public int ReclaimIdleMs { get; init; } = 60_000;

    /// <summary>
    /// Approximate cap on the number of entries retained in the Redis stream (XADD MAXLEN ~). Bounds
    /// Redis memory if the consumer falls behind or the app is down; acknowledged entries are also
    /// trimmed. Generous so a healthy consumer never loses unprocessed entries.
    /// </summary>
    public int MaxStreamLength { get; init; } = 1_000_000;
}
