using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Storage.Internal.Entities.CustomAnomalyResult;

[StoredDomainEntity(typeof(ICustomAnomalyResult))]
internal record CustomAnomalyResultEntity : Entity
{
    public required Guid DetectorId { get; init; }
    public required Guid AgentCallId { get; init; }
    public required Guid ProjectId { get; init; }
    public required string MatchedTrigger { get; init; }
    public string? Reasoning { get; init; }
}
