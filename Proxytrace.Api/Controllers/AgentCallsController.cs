using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Statistics;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/agent-calls")]
public class AgentCallsController : ControllerBase
{
    private static readonly JsonSerializerOptions SseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly IAgentCallRepository repository;
    private readonly IAgentRepository agentRepository;
    private readonly IDashboardStatistics statistics;
    private readonly ITraceBroadcaster traceBroadcaster;

    public AgentCallsController(
        IAgentCallRepository repository,
        IAgentRepository agentRepository,
        IDashboardStatistics statistics,
        ITraceBroadcaster traceBroadcaster)
    {
        this.repository = repository;
        this.agentRepository = agentRepository;
        this.statistics = statistics;
        this.traceBroadcaster = traceBroadcaster;
    }

    [HttpGet]
    public async Task<PagedResult<AgentCallDto>> GetAll(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        [FromQuery] string? model = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int? httpStatus = null,
        [FromQuery] bool includeSystemAgents = true,
        [FromQuery] string? q = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Clamp(page, pageSize);
        var filter = new AgentCallFilter(agentId, projectId, endpointId, model, from, to, httpStatus, includeSystemAgents, q);
        var (items, total) = await repository.GetFilteredAsync(filter, page, pageSize, cancellationToken);
        return new PagedResult<AgentCallDto>(items.Select(AgentCallDtoMapper.ToDto).ToArray(), total, page, pageSize);
    }

    [HttpGet("overview")]
    public async Task<TracesOverviewDto> GetOverview(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] DateTimeOffset? from = null,
        CancellationToken cancellationToken = default)
    {
        var latencyFilter = new StatisticsFilter(from, null, projectId, agentId);
        var breakdownFilter = new StatisticsFilter(from, null, projectId);

        Task<IReadOnlyList<IAgent>> agentsTask = agentRepository.GetAllAsync(cancellationToken);
        Task<IReadOnlyDictionary<Guid, DateTimeOffset>> lastCallTask = repository.GetLastCallTimesAsync(cancellationToken);
        Task<IReadOnlyList<AgentBreakdownStat>> breakdownTask = statistics.GetAgentBreakdownAsync(breakdownFilter, cancellationToken);
        Task<IReadOnlyList<LatencyStat>> latencyTask = statistics.GetLatencyAsync(latencyFilter, cancellationToken);

        await Task.WhenAll(agentsTask, lastCallTask, breakdownTask, latencyTask);

        IReadOnlyDictionary<Guid, DateTimeOffset> lastCall = lastCallTask.Result;
        AgentDto[] agents = agentsTask.Result
            .Where(a => !projectId.HasValue || a.Project.Id == projectId.Value)
            .OrderByDescending(a => lastCall.TryGetValue(a.Id, out var t) ? t : DateTimeOffset.MinValue)
            .ThenByDescending(a => a.UpdatedAt)
            .Select(a => AgentDtoMapper.ToDto(a, lastCall.TryGetValue(a.Id, out var t) ? t : null))
            .ToArray();

        return new TracesOverviewDto(
            agents,
            breakdownTask.Result.Select(r => new AgentBreakdownDto(r.AgentId, r.CallCount)).ToArray(),
            latencyTask.Result.Select(r => new LatencyDto(r.EndpointId, r.P50Ms, r.P95Ms, r.P99Ms, r.MinMs, r.MaxMs, r.SampleCount)).ToArray());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentCallDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var call = await repository.FindAsync(id, cancellationToken);
        if (call is null)
            return NotFound();
        return AgentCallDtoMapper.ToDto(call);
    }

    [HttpGet("stream")]
    public async Task Stream(CancellationToken cancellationToken)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = traceBroadcaster.Subscribe(cancellationToken);

        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            var data = JsonSerializer.Serialize(evt, SseOptions);
            await Response.WriteAsync($"event: trace-created\ndata: {data}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }
}
