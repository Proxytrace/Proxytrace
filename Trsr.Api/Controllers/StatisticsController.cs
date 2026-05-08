using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Statistics;
using Trsr.Domain;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/statistics")]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsQueryService statistics;

    public StatisticsController(IStatisticsQueryService statistics)
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
        return results.Select(r => new PassRateDto(r.SuiteId, r.RunTimestamp, r.PassCount, r.FailCount, r.UndecidedCount)).ToArray();
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
}
