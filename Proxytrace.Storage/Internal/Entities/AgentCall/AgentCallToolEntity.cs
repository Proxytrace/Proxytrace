namespace Proxytrace.Storage.Internal.Entities.AgentCall;

// Storage-only child of AgentCallEntity (no domain counterpart, like junction entities): one row
// per distinct tool name the response requested. ProjectId and AgentId are denormalised from the
// agent version so the tool-name picker's DISTINCT query stays single-table on this high-volume
// data — project-wide via (ProjectId, ToolName), agent-scoped via (ProjectId, AgentId, ToolName).
internal record AgentCallToolEntity : Entity
{
    public required Guid AgentCallId { get; init; }
    public required Guid ProjectId { get; init; }
    public required Guid AgentId { get; init; }
    public required string ToolName { get; init; }
}
