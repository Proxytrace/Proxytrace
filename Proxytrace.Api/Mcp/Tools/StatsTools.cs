using System.ComponentModel;
using ModelContextProtocol.Server;
using Proxytrace.Api.Dto.Statistics;
using Proxytrace.Application.Statistics;

namespace Proxytrace.Api.Mcp.Tools;

/// <summary>
/// Compact project dashboard returned by <see cref="StatsTools.GetDashboard"/>: headline totals plus a
/// per-model usage breakdown. Purpose-built for agents — the full REST dashboard payload is UI-shaped.
/// </summary>
internal sealed record McpDashboardDto(SummaryDto Summary, IReadOnlyList<ModelBreakdownDto> Models);

/// <summary>
/// MCP tool exposing project-wide usage statistics for the current project.
/// </summary>
[McpServerToolType]
internal sealed class StatsTools
{
    private const int RecentTraceCount = 5;
    private const int AgentLimit = 20;

    private readonly IMcpProjectAccessor project;
    private readonly IDashboardStatistics dashboard;

    public StatsTools(IMcpProjectAccessor project, IDashboardStatistics dashboard)
    {
        this.project = project;
        this.dashboard = dashboard;
    }

    [McpServerTool(Name = "get_dashboard")]
    [Description("Get project-wide usage statistics: total calls, token usage, average latency, overall " +
                 "pass rate, and a per-model breakdown. Optionally bound the window with from/to (ISO-8601).")]
    public async Task<McpDashboardDto> GetDashboard(
        [Description("Optional start of the window (ISO-8601). Omit for all-time.")] DateTimeOffset? from = null,
        [Description("Optional end of the window (ISO-8601). Omit for all-time.")] DateTimeOffset? to = null,
        CancellationToken cancellationToken = default)
    {
        var p = await project.GetProjectAsync(cancellationToken);
        var filter = new StatisticsFilter(from, to, p.Id);
        var view = await dashboard.GetDashboardViewAsync(filter, RecentTraceCount, AgentLimit, cancellationToken);

        var summary = new SummaryDto(
            view.Summary.TotalCalls,
            view.Summary.TotalInputTokens,
            view.Summary.TotalOutputTokens,
            view.Summary.AvgLatencyMs,
            view.Summary.OverallPassRate);
        var models = view.ModelBreakdown
            .Select(r => new ModelBreakdownDto(
                r.EndpointId, r.ModelName, r.CallCount,
                r.TotalInputTokens ?? 0, r.TotalOutputTokens ?? 0, r.AvgDurationMs ?? 0))
            .ToArray();

        return new McpDashboardDto(summary, models);
    }
}
