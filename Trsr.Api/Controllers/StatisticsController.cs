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
        return results.Select(r => new TokenUsageDto(r.Date, r.EndpointId, r.InputTokens, r.OutputTokens)).ToArray();
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
        return results.Select(r => new PassRateDto(r.AgentId, r.RunTimestamp, r.PassCount, r.FailCount, r.UndecidedCount)).ToArray();
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
        return results.Select(r => new ModelBreakdownDto(r.EndpointId, r.ModelName, r.CallCount, r.TotalInputTokens, r.TotalOutputTokens, r.AvgDurationMs)).ToArray();
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
}
