using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Statistics;
using Proxytrace.Application.Statistics;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/statistics")]
public class StatisticsController : ControllerBase
{
    private readonly IDashboardStatistics dashboard;
    private readonly IAgentStatistics agentStatistics;
    private readonly AgentCallDtoMapper agentCallDtoMapper;
    private readonly AgentDtoMapper agentDtoMapper;

    public StatisticsController(
        IDashboardStatistics dashboard,
        IAgentStatistics agentStatistics,
        AgentCallDtoMapper agentCallDtoMapper,
        AgentDtoMapper agentDtoMapper)
    {
        this.dashboard = dashboard;
        this.agentStatistics = agentStatistics;
        this.agentCallDtoMapper = agentCallDtoMapper;
        this.agentDtoMapper = agentDtoMapper;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardViewDto>> GetDashboardView(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int recentTraceCount = 6,
        [FromQuery] int agentLimit = 10,
        CancellationToken cancellationToken = default)
    {
        if (from is not null && to is not null && from.Value >= to.Value)
            return BadRequest("Query parameter 'from' must be before 'to'.");
        recentTraceCount = Math.Clamp(recentTraceCount, 1, 50);
        agentLimit = Math.Clamp(agentLimit, 1, 100);
        var filter = new StatisticsFilter(from, to, projectId);
        DashboardView view = await dashboard.GetDashboardViewAsync(filter, recentTraceCount, agentLimit, cancellationToken);

        return new DashboardViewDto(
            Summary: new SummaryDto(view.Summary.TotalCalls, view.Summary.TotalInputTokens, view.Summary.TotalOutputTokens, view.Summary.AvgLatencyMs, view.Summary.OverallPassRate),
            LiveTelemetry: new LiveTelemetryDto(view.LiveTelemetry.TracesPerMinute, view.LiveTelemetry.TokensPerSecond, view.LiveTelemetry.QueueDepth, view.LiveTelemetry.ErrorRate, view.LiveTelemetry.P95Ms, view.LiveTelemetry.ProxyVersion),
            Trends: new DashboardTrendsDto(view.Trends.Traces, view.Trends.LatencyMs, view.Trends.Throughput, view.Trends.PassRate),
            AgentBreakdown: view.AgentBreakdown.Select(r => new AgentBreakdownDto(r.AgentId, r.CallCount)).ToArray(),
            Latency: view.Latency.Select(r => new LatencyDto(r.EndpointId, r.P50Ms, r.P95Ms, r.P99Ms, r.MinMs, r.MaxMs, r.SampleCount)).ToArray(),
            ModelBreakdown: view.ModelBreakdown.Select(r => new ModelBreakdownDto(r.EndpointId, r.ModelName, r.CallCount, r.TotalInputTokens ?? 0, r.TotalOutputTokens ?? 0, r.AvgDurationMs ?? 0)).ToArray(),
            TokenUsage: view.TokenUsage.Select(r => new TokenUsageDto(r.Date, r.EndpointId, r.InputTokens ?? 0, r.OutputTokens ?? 0)).ToArray(),
            TokenUsageByAgent: view.TokenUsageByAgent.Select(r => new AgentTokenUsageDto(r.Date, r.AgentId, r.InputTokens, r.OutputTokens)).ToArray(),
            RecentTraces: view.RecentTraces.Select(agentCallDtoMapper.ToDto).ToArray(),
            Agents: view.Agents.Select(a => agentDtoMapper.ToDto(a, view.AgentLastCallTimes.TryGetValue(a.Id, out var t) ? t : null)).ToArray());
    }

    [HttpGet("agents/{agentId:guid}/overview")]
    public async Task<ActionResult<AgentOverviewDto>> GetAgentOverview(
        Guid agentId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        CancellationToken cancellationToken = default)
    {
        if (from is null || to is null)
            return BadRequest("Query parameters 'from' and 'to' are required.");
        if (from.Value >= to.Value)
            return BadRequest("Query parameter 'from' must be before 'to'.");

        var result = await agentStatistics.GetAgentOverviewAsync(agentId, from.Value, to.Value, bucket, cancellationToken);
        return new AgentOverviewDto(
            Summary: ToDto(result.Summary),
            TimeSeries: result.TimeSeries.Select(ToDto).ToArray(),
            PassRateTrend: result.PassRateTrend.Select(ToDto).ToArray(),
            SuitePassRates: result.SuitePassRates.Select(ToDto).ToArray(),
            Counts: ToDto(result.Counts));
    }

    private static AgentTimeSummaryDto ToDto(AgentTimeSummary s) =>
        new(s.TotalTraces, s.TotalInputTokens, s.TotalOutputTokens, s.TotalCostEur, s.AvgLatencyMs);

    private static AgentTimeSeriesPointDto ToDto(AgentTimeSeriesPoint p) =>
        new(p.BucketStart, p.TraceCount, p.InputTokens, p.OutputTokens, p.CostEur, p.AvgLatencyMs);

    private static AgentPassRatePointDto ToDto(AgentPassRatePoint p) =>
        new(p.BucketStart, p.Passed, p.TestCases);

    private static AgentSuitePassRateDto ToDto(AgentSuitePassRate s) =>
        new(s.SuiteId, s.SuiteName, s.LatestRunAt, s.Passed, s.TestCases);

    private static AgentEntityCountsDto ToDto(AgentEntityCounts c) =>
        new(c.SuiteCount, c.TestCaseCount, c.OpenProposalCount, c.TotalProposalCount);
}
