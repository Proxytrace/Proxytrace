using Proxytrace.Api.Dto.AgentCalls;

namespace Proxytrace.Api.Dto.Anomalies;

/// <summary>
/// One row of the anomaly dashboard's recent list: the flagged call in the traces list-item shape
/// plus the custom-detector attributions for it (empty for purely statistical outliers).
/// </summary>
public record AnomalyListItemDto(
    AgentCallListItemDto Call,
    IReadOnlyList<CustomAnomalyHitDto> CustomAnomalies);

/// <summary>
/// A custom detector's anomalous verdict on a call — which detector fired, the trigger pattern
/// whose match gated the review, and the judge's reasoning if it provided one.
/// </summary>
public record CustomAnomalyHitDto(
    Guid DetectorId,
    string DetectorName,
    string MatchedTrigger,
    string? Reasoning);
