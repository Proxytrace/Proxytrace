namespace Proxytrace.Domain.AgentCall;

/// <summary>
/// Which per-call characteristics flagged this call as an outlier relative to its agent's recent
/// baseline. Computed once at ingestion (see the ingestion outlier detector) and persisted as a
/// single byte column. A value of <see cref="None"/> means the call is not an outlier; any set bit
/// makes it one. Stored as a bitmask so the UI can show <em>why</em> a call is flagged and so new
/// characteristics can be added without a schema change — the upper bits are reserved.
/// </summary>
[Flags]
public enum OutlierFlags : byte
{
    /// <summary>Not an outlier.</summary>
    None = 0,

    /// <summary>Total tokens (input + output) far above the agent's recent mean. Doubles as the cost signal.</summary>
    HighTokens = 1,

    /// <summary>Response latency far above the agent's recent mean.</summary>
    HighLatency = 2,

    /// <summary>Turn-2+ prompt cache-hit rate far below the agent's recent mean.</summary>
    LowCacheHit = 4,

    /// <summary>Tool-request count far above the agent's recent mean.</summary>
    ManyToolCalls = 8,
}
