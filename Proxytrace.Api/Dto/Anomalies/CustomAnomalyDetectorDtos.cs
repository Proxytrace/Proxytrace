using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Api.Dto.Anomalies;

public record AnomalyTriggerDto(TriggerKind Kind, string Pattern);

public record CustomAnomalyDetectorDto(
    Guid Id,
    string Name,
    string Instructions,
    Guid ProjectId,
    Guid EndpointId,
    string EndpointName,
    IReadOnlyList<AnomalyTriggerDto> Triggers,
    bool AllAgents,
    IReadOnlyList<Guid> AgentIds,
    bool IsEnabled,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateCustomAnomalyDetectorRequest
{
    public required Guid ProjectId { get; init; }
    public required string Name { get; init; }

    /// <summary>The LLM review instructions — become the hidden system agent's system prompt.</summary>
    public required string Instructions { get; init; }

    /// <summary>The model endpoint the hidden system agent reviews with.</summary>
    public required Guid EndpointId { get; init; }

    public required IReadOnlyList<AnomalyTriggerDto> Triggers { get; init; }
    public bool AllAgents { get; init; } = true;
    public IReadOnlyList<Guid>? AgentIds { get; init; }
    public bool IsEnabled { get; init; } = true;
}

public sealed record UpdateCustomAnomalyDetectorRequest
{
    public required string Name { get; init; }
    public required string Instructions { get; init; }

    /// <summary>Null keeps the hidden agent's current endpoint.</summary>
    public Guid? EndpointId { get; init; }

    public required IReadOnlyList<AnomalyTriggerDto> Triggers { get; init; }
    public required bool AllAgents { get; init; }
    public IReadOnlyList<Guid>? AgentIds { get; init; }
    public required bool IsEnabled { get; init; }
}
