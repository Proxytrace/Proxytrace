using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Statistics;
using Trsr.Application.Statistics;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/statistics")]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsService statistics;

    public StatisticsController(IStatisticsService statistics)
    {
        this.statistics = statistics;
    }

    [HttpGet("summary")]
    public async Task<SummaryDto> GetSummary(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endPointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endPointId);
        var result = await statistics.GetSummaryAsync(filter, cancellationToken);
        return new SummaryDto(result.TotalCalls, result.TotalInputTokens, result.TotalOutputTokens, result.AvgLatencyMs, result.OverallPassRate);
    }

    [HttpGet("token-usage")]
    public async Task<IReadOnlyList<TokenUsageDto>> GetTokenUsage(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endPointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endPointId);
        var results = await statistics.GetTokenUsageAsync(filter, cancellationToken);
        return results.Select(r => new TokenUsageDto(r.Date, r.EndpointId, r.InputTokens ?? 0, r.OutputTokens ?? 0)).ToArray();
    }

    [HttpGet("latency")]
    public async Task<IReadOnlyList<LatencyDto>> GetLatency(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endpointId);
        var results = await statistics.GetLatencyAsync(filter, cancellationToken);
        return results.Select(r => new LatencyDto(r.EndpointId, r.P50Ms, r.P95Ms, r.P99Ms, r.MinMs, r.MaxMs, r.SampleCount)).ToArray();
    }

    [HttpGet("pass-rates")]
    public async Task<IReadOnlyList<PassRateDto>> GetPassRates(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endpointId);
        var results = await statistics.GetPassRatesAsync(filter, cancellationToken);
        return results.Select(r => new PassRateDto(r.SuiteId, r.RunTimestamp, r.PassCount, r.FailCount)).ToArray();
    }

    [HttpGet("error-rates")]
    public async Task<IReadOnlyList<ErrorRateDto>> GetErrorRates(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endpointId);
        var results = await statistics.GetErrorRatesAsync(filter, cancellationToken);
        return results.Select(r => new ErrorRateDto(r.EndpointId, r.TotalCalls, r.ErrorCalls, r.ErrorRate)).ToArray();
    }

    [HttpGet("model-breakdown")]
    public async Task<IReadOnlyList<ModelBreakdownDto>> GetModelBreakdown(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endpointId);
        var results = await statistics.GetModelBreakdownAsync(filter, cancellationToken);
        return results.Select(r => new ModelBreakdownDto(r.EndpointId, r.ModelName, r.CallCount, r.TotalInputTokens ?? 0, r.TotalOutputTokens ?? 0, r.AvgDurationMs ?? 0)).ToArray();
    }

    [HttpGet("agent-breakdown")]
    public async Task<IReadOnlyList<AgentBreakdownDto>> GetAgentBreakdown(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId);
        var results = await statistics.GetAgentBreakdownAsync(filter, cancellationToken);
        return results.Select(r => new AgentBreakdownDto(r.AgentId, r.CallCount)).ToArray();
    }

    [HttpGet("live-telemetry")]
    public async Task<LiveTelemetryDto> GetLiveTelemetry(
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(ProjectId: projectId);
        var result = await statistics.GetLiveTelemetryAsync(filter, cancellationToken);
        return new LiveTelemetryDto(result.TracesPerMinute, result.TokensPerSecond, result.QueueDepth, result.ErrorRate, result.P95Ms, result.ProxyVersion);
    }

    [HttpGet("token-usage-by-agent")]
    public async Task<IReadOnlyList<AgentTokenUsageDto>> GetTokenUsageByAgent(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId);
        var results = await statistics.GetTokenUsageByAgentAsync(filter, cancellationToken);
        return results.Select(r => new AgentTokenUsageDto(r.Date, r.AgentId, r.InputTokens, r.OutputTokens)).ToArray();
    }

    [HttpGet("dashboard-trends")]
    public async Task<DashboardTrendsDto> GetDashboardTrends(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId);
        var result = await statistics.GetDashboardTrendsAsync(filter, cancellationToken);
        return new DashboardTrendsDto(result.Traces, result.LatencyMs, result.Throughput, result.PassRate);
    }

    [HttpGet("cost-estimate")]
    public async Task<IReadOnlyList<CostEstimateDto>> GetCostEstimate(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticsFilter(from, to, projectId, agentId, endpointId);
        var results = await statistics.GetCostEstimateAsync(filter, cancellationToken);
        return results.Select(r => new CostEstimateDto(r.EndpointId, r.InputCostEur, r.OutputCostEur, r.TotalCostEur)).ToArray();
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

        var result = await statistics.GetAgentOverviewAsync(agentId, from.Value, to.Value, bucket, cancellationToken);
        return new AgentOverviewDto(
            Summary: ToDto(result.Summary),
            TimeSeries: result.TimeSeries.Select(ToDto).ToArray(),
            PassRateTrend: result.PassRateTrend.Select(ToDto).ToArray(),
            SuitePassRates: result.SuitePassRates.Select(ToDto).ToArray(),
            Counts: ToDto(result.Counts));
    }

    [HttpGet("agents/{agentId:guid}/time-series")]
    public async Task<ActionResult<IReadOnlyList<AgentTimeSeriesPointDto>>> GetAgentTimeSeries(
        Guid agentId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        CancellationToken cancellationToken = default)
    {
        if (from is null || to is null)
            return BadRequest("Query parameters 'from' and 'to' are required.");

        var result = await statistics.GetAgentTimeSeriesAsync(agentId, from.Value, to.Value, bucket, cancellationToken);
        return result.Select(ToDto).ToArray();
    }

    [HttpGet("agents/{agentId:guid}/pass-rate-trend")]
    public async Task<ActionResult<IReadOnlyList<AgentPassRatePointDto>>> GetAgentPassRateTrend(
        Guid agentId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        CancellationToken cancellationToken = default)
    {
        if (from is null || to is null)
            return BadRequest("Query parameters 'from' and 'to' are required.");

        var result = await statistics.GetAgentPassRateTrendAsync(agentId, from.Value, to.Value, bucket, cancellationToken);
        return result.Select(ToDto).ToArray();
    }

    [HttpGet("agents/{agentId:guid}/suite-pass-rates")]
    public async Task<IReadOnlyList<AgentSuitePassRateDto>> GetAgentSuitePassRates(
        Guid agentId,
        CancellationToken cancellationToken = default)
    {
        var result = await statistics.GetAgentLatestSuitePassRatesAsync(agentId, cancellationToken);
        return result.Select(ToDto).ToArray();
    }

    [HttpGet("agents/{agentId:guid}/counts")]
    public async Task<AgentEntityCountsDto> GetAgentCounts(
        Guid agentId,
        CancellationToken cancellationToken = default)
    {
        var result = await statistics.GetAgentEntityCountsAsync(agentId, cancellationToken);
        return ToDto(result);
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

    [HttpGet("evaluators/{evaluatorId:guid}/overview")]
    public async Task<ActionResult<EvaluatorOverviewDto>> GetEvaluatorOverview(
        Guid evaluatorId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        CancellationToken cancellationToken = default)
    {
        if (from is null || to is null)
            return BadRequest("Query parameters 'from' and 'to' are required.");

        var result = await statistics.GetEvaluatorOverviewAsync(evaluatorId, from.Value, to.Value, bucket, cancellationToken);
        return new EvaluatorOverviewDto(
            Summary: ToDto(result.Summary),
            PassRateTrend: result.PassRateTrend.Select(ToDto).ToArray(),
            ScoreDistribution: result.ScoreDistribution.Select(ToDto).ToArray(),
            CostTrend: result.CostTrend.Select(ToDto).ToArray());
    }

    [HttpGet("evaluators/sparklines")]
    public async Task<ActionResult<IReadOnlyList<EvaluatorSparklineDto>>> GetEvaluatorSparklines(
        [FromQuery] Guid? projectId = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        CancellationToken cancellationToken = default)
    {
        if (projectId is null || from is null || to is null)
            return BadRequest("Query parameters 'projectId', 'from' and 'to' are required.");

        var result = await statistics.GetEvaluatorSparklinesAsync(projectId.Value, from.Value, to.Value, bucket, cancellationToken);
        return result.Select(s => new EvaluatorSparklineDto(s.EvaluatorId, s.Points.Select(ToDto).ToArray())).ToArray();
    }

    private static EvaluatorSummaryDto ToDto(EvaluatorSummary s) =>
        new(s.TotalEvaluations, s.AvgScore, s.OverallPassRate, s.InputTokens, s.OutputTokens, s.TotalCost, s.AvgLatencyMs);

    private static EvaluatorPassRatePointDto ToDto(EvaluatorPassRatePoint p) =>
        new(p.BucketStart, p.Passed, p.Total);

    private static EvaluatorScoreBucketDto ToDto(EvaluatorScoreBucket b) =>
        new(b.Score, b.Count);

    private static EvaluatorCostPointDto ToDto(EvaluatorCostPoint p) =>
        new(p.BucketStart, p.InputTokens, p.OutputTokens, p.Cost, p.AvgLatencyMs);
}
