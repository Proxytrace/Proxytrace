using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Configuration;
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
    private readonly StatisticsOptions options;

    public StatisticsController(
        IDashboardStatistics dashboard,
        IAgentStatistics agentStatistics,
        AgentCallDtoMapper agentCallDtoMapper,
        AgentDtoMapper agentDtoMapper,
        StatisticsOptions options)
    {
        this.dashboard = dashboard;
        this.agentStatistics = agentStatistics;
        this.agentCallDtoMapper = agentCallDtoMapper;
        this.agentDtoMapper = agentDtoMapper;
        this.options = options;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardViewDto>> GetDashboardView(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int? recentTraceCount = null,
        [FromQuery] int? agentLimit = null,
        [FromQuery] bool excludeSystemAgents = false,
        CancellationToken cancellationToken = default)
    {
        if (from is not null && to is not null && from.Value >= to.Value)
            return BadRequest("Query parameter 'from' must be before 'to'.");
        var resolvedRecentTraceCount = Math.Clamp(
            recentTraceCount ?? options.DefaultRecentTraceCount, 1, options.MaxRecentTraceCount);
        var resolvedAgentLimit = Math.Clamp(
            agentLimit ?? options.DefaultAgentLimit, 1, options.MaxAgentLimit);
        var filter = new StatisticsFilter(from, to, projectId, ExcludeSystemAgents: excludeSystemAgents);
        DashboardView view = await dashboard.GetDashboardViewAsync(filter, resolvedRecentTraceCount, resolvedAgentLimit, cancellationToken);

        return new DashboardViewDto(
            Summary: new SummaryDto(view.Summary.TotalCalls, view.Summary.TotalInputTokens, view.Summary.TotalOutputTokens, view.Summary.TotalCachedInputTokens, view.Summary.AvgLatencyMs, view.Summary.OverallPassRate),
            LiveTelemetry: new LiveTelemetryDto(view.LiveTelemetry.TracesPerMinute, view.LiveTelemetry.TokensPerSecond, view.LiveTelemetry.QueueDepth, view.LiveTelemetry.ErrorRate, view.LiveTelemetry.P95Ms, view.LiveTelemetry.ProxyVersion),
            Trends: new DashboardTrendsDto(view.Trends.Traces, view.Trends.LatencyMs, view.Trends.Throughput, view.Trends.PassRate),
            AgentBreakdown: view.AgentBreakdown.Select(r => new AgentBreakdownDto(r.AgentId, r.CallCount)).ToArray(),
            Latency: view.Latency.Select(r => new LatencyDto(r.EndpointId, r.P50Ms, r.P95Ms, r.P99Ms, r.MinMs, r.MaxMs, r.SampleCount)).ToArray(),
            ModelBreakdown: view.ModelBreakdown.Select(r => new ModelBreakdownDto(r.EndpointId, r.ModelName, r.CallCount, r.TotalInputTokens ?? 0, r.TotalOutputTokens ?? 0, r.TotalCachedInputTokens ?? 0, r.AvgDurationMs ?? 0)).ToArray(),
            TokenUsage: view.TokenUsage.Select(r => new TokenUsageDto(r.BucketStart, r.EndpointId, r.InputTokens ?? 0, r.OutputTokens ?? 0, r.CachedInputTokens ?? 0)).ToArray(),
            TokenUsageByAgent: view.TokenUsageByAgent.Select(r => new AgentTokenUsageDto(r.BucketStart, r.AgentId, r.InputTokens, r.OutputTokens, r.CachedInputTokens)).ToArray(),
            TokenBucket: view.TokenBucket switch
            {
                StatisticsBucket.FiveMinutes => "fiveMinutes",
                StatisticsBucket.Hourly => "hourly",
                _ => "daily",
            },
            RecentTraces: view.RecentTraces.Select(agentCallDtoMapper.ToListItemDto).ToArray(),
            Agents: view.Agents.Select(a => agentDtoMapper.ToListItemDto(a, view.AgentLastCallTimes.TryGetValue(a.Id, out var t) ? t : null)).ToArray());
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

    [HttpGet("agents/{agentId:guid}/distributions")]
    public async Task<ActionResult<AgentDistributionsDto>> GetAgentDistributions(
        Guid agentId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken cancellationToken = default)
    {
        if (from is null || to is null)
            return BadRequest("Query parameters 'from' and 'to' are required.");
        if (from.Value >= to.Value)
            return BadRequest("Query parameter 'from' must be before 'to'.");

        AgentCallDistributions result = await agentStatistics.GetAgentDistributionsAsync(agentId, from.Value, to.Value, cancellationToken);
        return new AgentDistributionsDto(
            InputTokensPerCall: ToDto(result.InputTokensPerCall),
            OutputTokensPerCall: ToDto(result.OutputTokensPerCall),
            LatencyMsPerCall: ToDto(result.LatencyMsPerCall),
            CostPerConversationEur: ToDto(result.CostPerConversationEur),
            CacheHitRatePerConversation: ToDto(result.CacheHitRatePerConversation),
            ToolCallsPerConversation: ToDto(result.ToolCallsPerConversation));
    }

    private static MetricDistributionDto ToDto(MetricDistribution d) =>
        new(d.Mean, d.StdDev, d.SampleCount, d.Min, d.Max,
            d.Histogram.Select(b => new HistogramBinDto(b.Start, b.End, b.Count)).ToArray());

    private static AgentTimeSummaryDto ToDto(AgentTimeSummary s) =>
        new(s.TotalTraces, s.TotalInputTokens, s.TotalOutputTokens, s.TotalCachedInputTokens, s.TotalCostEur, s.AvgLatencyMs);

    private static AgentTimeSeriesPointDto ToDto(AgentTimeSeriesPoint p) =>
        new(p.BucketStart, p.TraceCount, p.InputTokens, p.OutputTokens, p.CachedInputTokens, p.CostEur, p.AvgLatencyMs);

    private static AgentPassRatePointDto ToDto(AgentPassRatePoint p) =>
        new(p.BucketStart, p.Passed, p.TestCases);

    private static AgentSuitePassRateDto ToDto(AgentSuitePassRate s) =>
        new(s.SuiteId, s.SuiteName, s.LatestRunAt, s.Passed, s.TestCases);

    private static AgentEntityCountsDto ToDto(AgentEntityCounts c) =>
        new(c.SuiteCount, c.TestCaseCount, c.OpenProposalCount, c.TotalProposalCount);
}
