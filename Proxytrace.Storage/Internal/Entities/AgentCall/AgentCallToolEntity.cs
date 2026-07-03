namespace Proxytrace.Storage.Internal.Entities.AgentCall;

// Storage-only child of AgentCallEntity (no domain counterpart, like junction entities): one row
// per distinct tool name the response requested. ProjectId is denormalised from the agent version
// so the tool-name picker's DISTINCT query stays single-table on this high-volume data.
internal record AgentCallToolEntity : Entity
{
    public required Guid AgentCallId { get; init; }
    public required Guid ProjectId { get; init; }
    public required string ToolName { get; init; }
}
