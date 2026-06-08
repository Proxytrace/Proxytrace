using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Json;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Statistics;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/agent-calls")]
public class AgentCallsController : ControllerBase
{
    private readonly IAgentCallRepository repository;
    private readonly IAgentRepository agentRepository;
    private readonly IDashboardStatistics statistics;
    private readonly ITraceBroadcaster traceBroadcaster;
    private readonly AgentCallDtoMapper agentCallDtoMapper;
    private readonly AgentDtoMapper agentDtoMapper;
    private readonly IAgentCall.CreateNew createCall;
    private readonly ICompletion.Create createCompletion;

    public AgentCallsController(
        IAgentCallRepository repository,
        IAgentRepository agentRepository,
        IDashboardStatistics statistics,
        ITraceBroadcaster traceBroadcaster,
        AgentCallDtoMapper agentCallDtoMapper,
        AgentDtoMapper agentDtoMapper,
        IAgentCall.CreateNew createCall,
        ICompletion.Create createCompletion)
    {
        this.repository = repository;
        this.agentRepository = agentRepository;
        this.statistics = statistics;
        this.traceBroadcaster = traceBroadcaster;
        this.agentCallDtoMapper = agentCallDtoMapper;
        this.agentDtoMapper = agentDtoMapper;
        this.createCall = createCall;
        this.createCompletion = createCompletion;
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
        [FromQuery] Guid? conversationId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Clamp(page, pageSize);
        var filter = new AgentCallFilter(agentId, projectId, endpointId, model, from, to, httpStatus, includeSystemAgents, q, conversationId);
        var (items, total) = await repository.GetFilteredAsync(filter, page, pageSize, cancellationToken);
        return new PagedResult<IAgentCall>(items, total, page, pageSize).Map(agentCallDtoMapper.ToDto);
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
            .Select(a => agentDtoMapper.ToDto(a, lastCall.TryGetValue(a.Id, out var t) ? t : null))
            .ToArray();

        return new TracesOverviewDto(
            agents,
            breakdownTask.Result.Select(r => new AgentBreakdownDto(r.AgentId, r.CallCount)).ToArray(),
            latencyTask.Result.Select(r => new LatencyDto(r.EndpointId, r.P50Ms, r.P95Ms, r.P99Ms, r.MinMs, r.MaxMs, r.SampleCount)).ToArray());
    }

    [HttpGet("histogram")]
    public async Task<IReadOnlyList<TraceHistogramBucketDto>> GetHistogram(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        [FromQuery] string? model = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int? httpStatus = null,
        [FromQuery] bool includeSystemAgents = true,
        [FromQuery] string? q = null,
        [FromQuery] Guid? conversationId = null,
        [FromQuery] int buckets = 60,
        CancellationToken cancellationToken = default)
    {
        buckets = Math.Clamp(buckets, 1, 240);
        var filter = new AgentCallFilter(agentId, projectId, endpointId, model, from, to, httpStatus, includeSystemAgents, q, conversationId);
        var result = await repository.GetHistogramAsync(filter, buckets, cancellationToken);
        return result.Select(b => new TraceHistogramBucketDto(b.Start, b.Total, b.Errors)).ToList();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentCallDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var call = await repository.FindAsync(id, cancellationToken);
        if (call is null)
            return NotFound();
        return agentCallDtoMapper.ToDto(call);
    }

    /// <summary>
    /// Test-only: seeds an agent call (trace) directly, bypassing the ingestion pipeline so the
    /// e2e suite can create traces without making real LLM calls. The call is recorded against the
    /// resolved agent's current version and endpoint, with an HTTP 200 status and a "stop" finish
    /// reason.
    /// </summary>
    [HttpPost("seed")]
    public async Task<ActionResult<AgentCallDto>> Seed(
        [FromBody] SeedAgentCallRequest request,
        CancellationToken cancellationToken)
    {
        IAgent? agent = await agentRepository.FindAsync(request.AgentId, cancellationToken);
        if (agent is null)
            return NotFound();

        var conversation = Conversation.Create();
        if (!string.IsNullOrEmpty(request.SystemContent))
            conversation.AddSystemMessage(new SystemMessage([Proxytrace.Domain.Message.Content.FromText(request.SystemContent)]));
        conversation.Add(new UserMessage([Proxytrace.Domain.Message.Content.FromText(request.UserContent)]));

        var assistantMessage = new AssistantMessage([Proxytrace.Domain.Message.Content.FromText(request.AssistantContent)], []);
        var usage = new TokenUsage((ulong)request.InputTokens, (ulong)request.OutputTokens);
        ICompletion completion = createCompletion(
            assistantMessage,
            usage,
            TimeSpan.FromMilliseconds(request.DurationMs));

        IAgentCall call = await repository.AddAsync(
            createCall(
                agent: agent,
                version: agent.CurrentVersion,
                endpoint: agent.Endpoint,
                request: conversation,
                response: completion,
                httpStatus: HttpStatusCode.OK,
                finishReason: "stop",
                errorMessage: null,
                modelParameters: agent.ModelParameters,
                conversationId: request.ConversationId),
            cancellationToken);

        // Publish to the trace SSE broadcaster exactly as the ingestion pipeline does, so
        // dashboard/traces SSE clients receive the seeded trace.
        traceBroadcaster.Publish(TraceCreatedEvent.Create(call));

        return Ok(agentCallDtoMapper.ToDto(call));
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
            var data = JsonSerializer.Serialize(evt, ApiJsonOptions.Sse);
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
