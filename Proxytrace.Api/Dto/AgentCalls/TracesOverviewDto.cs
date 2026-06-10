using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Statistics;

namespace Proxytrace.Api.Dto.AgentCalls;

/// <summary>
/// Filter-bar metadata for the Traces page (project agents, per-agent call counts, latency).
/// Bundled so the page needs only this plus the paginated call list — two requests instead of four.
/// </summary>
public record TracesOverviewDto(
    IReadOnlyList<AgentListItemDto> Agents,
    IReadOnlyList<AgentBreakdownDto> AgentBreakdown,
    IReadOnlyList<LatencyDto> Latency);
