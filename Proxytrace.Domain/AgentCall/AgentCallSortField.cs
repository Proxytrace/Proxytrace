namespace Proxytrace.Domain.AgentCall;

/// <summary>Whitelisted sort columns for the traces list — every member maps to an indexed, denormalised scalar column.</summary>
public enum AgentCallSortField
{
    CreatedAt,
    Latency,
    TotalTokens,
    ToolCount,
    CacheHitRate,
}
