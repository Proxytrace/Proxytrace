using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Json;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/agents")]
public class AgentsController : ControllerBase
{
    private readonly IAgentRepository repository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly IRepository<IProject> projects;
    private readonly IAgentCallRepository agentCallRepository;
    private readonly IAgentVersionRepository agentVersionRepository;
    private readonly IProposalBroadcaster proposalBroadcaster;
    private readonly ITheoryBroadcaster theoryBroadcaster;
    private readonly AgentDtoMapper agentDtoMapper;
    private readonly IAgent.CreateNew createAgent;
    private readonly IPromptTemplate.Create createPromptTemplate;
    private readonly IModelParameters.Create createModelParameters;

    public AgentsController(
        IAgentRepository repository,
        IRepository<IModelEndpoint> endpoints,
        IRepository<IProject> projects,
        IAgentCallRepository agentCallRepository,
        IAgentVersionRepository agentVersionRepository,
        IProposalBroadcaster proposalBroadcaster,
        ITheoryBroadcaster theoryBroadcaster,
        AgentDtoMapper agentDtoMapper,
        IAgent.CreateNew createAgent,
        IPromptTemplate.Create createPromptTemplate,
        IModelParameters.Create createModelParameters)
    {
        this.repository = repository;
        this.endpoints = endpoints;
        this.projects = projects;
        this.agentCallRepository = agentCallRepository;
        this.agentVersionRepository = agentVersionRepository;
        this.proposalBroadcaster = proposalBroadcaster;
        this.theoryBroadcaster = theoryBroadcaster;
        this.agentDtoMapper = agentDtoMapper;
        this.createAgent = createAgent;
        this.createPromptTemplate = createPromptTemplate;
        this.createModelParameters = createModelParameters;
    }

    [HttpGet]
    public async Task<PagedResult<AgentListItemDto>> GetAll(
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        // Archived (soft-deleted) agents are hidden from the listing — they keep resolving by id for
        // history, but must not appear here (mirrors EvaluatorsController, which lists via the
        // archive-filtered GetAllAsync/GetByProjectAsync). EnumerateAsync streams the full set.
        var all = repository.EnumerateAsync(cancellationToken).Where(a => !a.IsArchived);
        var filtered = projectId.HasValue
            ? all.Where(a => a.Project.Id == projectId.Value)
            : all;

        var lastCallTimes = await agentCallRepository.GetLastCallTimesAsync(cancellationToken);

        var materialized = await filtered.ToArrayAsync(cancellationToken);
        var sorted = materialized
            .OrderByDescending(a => lastCallTimes.TryGetValue(a.Id, out var t) ? t : DateTimeOffset.MinValue)
            .ThenByDescending(a => a.UpdatedAt)
            .ToArray();

        (page, pageSize) = Paging.Clamp(page, pageSize);
        var items = sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => agentDtoMapper.ToListItemDto(a, lastCallTimes.TryGetValue(a.Id, out var t) ? t : null))
            .ToArray();
        return new PagedResult<AgentListItemDto>(items, sorted.Length, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var agent = await repository.FindAsync(id, cancellationToken);
        if (agent is null)
            return NotFound();
        var lastCallTimes = await agentCallRepository.GetLastCallTimesAsync(cancellationToken);
        return agentDtoMapper.ToDto(agent, lastCallTimes.TryGetValue(agent.Id, out var t) ? t : null);
    }

    /// <summary>
    /// Test-only: seeds an agent directly, bypassing the ingestion pipeline so the e2e suite can
    /// create agents without making real LLM calls. The endpoint is resolved by id; the project is
    /// resolved by id when supplied, otherwise the first/only project is used. The agent is created
    /// with an empty tool-set and <c>IsSystemAgent = false</c>.
    /// </summary>
    [HttpPost("seed")]
    [TestOnlyEndpoint]
    public async Task<ActionResult<AgentDto>> Seed(
        [FromBody] SeedAgentRequest request,
        CancellationToken cancellationToken)
    {
        IModelEndpoint? endpoint = await endpoints.FindAsync(request.EndpointId, cancellationToken);
        if (endpoint is null)
            return NotFound();

        IProject? project = request.ProjectId.HasValue
            ? await projects.FindAsync(request.ProjectId.Value, cancellationToken)
            : await projects.FindFirstAsync(cancellationToken);
        if (project is null)
            return NotFound();

        IAgent agent = await repository.AddAsync(
            createAgent(
                request.Name,
                createPromptTemplate(request.Name, request.SystemMessage),
                tools: [],
                endpoint: endpoint,
                project: project,
                modelParameters: createModelParameters(),
                isSystemAgent: false),
            cancellationToken);

        return Ok(agentDtoMapper.ToDto(agent, null));
    }

    [HttpGet("{id:guid}/proposals/stream")]
    public async Task StreamProposals(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = proposalBroadcaster.Subscribe(id, cancellationToken);
        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            string eventName = evt switch
            {
                ProposalCreatedEvent => "proposal-created",
                ProposalStatusChangedEvent => "proposal-status-changed",
                _ => "unknown",
            };
            var data = SseEventSerializer.Serialize(evt, evt.GetType());
            await Response.WriteAsync($"event: {eventName}\ndata: {data}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    [HttpGet("{id:guid}/theories/stream")]
    public async Task StreamTheories(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = theoryBroadcaster.Subscribe(id, cancellationToken);
        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            var data = SseEventSerializer.Serialize(evt);
            await Response.WriteAsync($"event: theory-changed\ndata: {data}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var agent = await repository.FindAsync(id, cancellationToken);
        if (agent is null)
            return NotFound();

        // System agents (Tracey, optimizers, agentic-evaluator judges) are internal plumbing, not
        // user data — they must not be archived away.
        if (agent.IsSystemAgent)
            return Conflict(new { error = "System agents can't be deleted." });

        // Soft-delete: archiving hides the agent and frees its license slot, but keeps the row so its
        // captured calls, suites, versions and any agentic evaluators still resolve. See
        // ArchivableRepository.
        var archived = await repository.ArchiveAsync(id, cancellationToken);
        return archived ? NoContent() : NotFound();
    }

    [HttpPatch("{id:guid}/endpoint")]
    public async Task<IActionResult> UpdateEndpoint(
        Guid id,
        [FromBody] UpdateAgentEndpointRequest request,
        CancellationToken cancellationToken)
    {
        IAgent agent = await repository.GetAsync(id, cancellationToken);
        IModelEndpoint endpoint = await endpoints.GetAsync(request.EndpointId, cancellationToken);
        await agent.ChangeEndpoint(endpoint, cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/versions")]
    public async Task<ActionResult<IReadOnlyList<AgentVersionDto>>> ListVersions(
        Guid id,
        CancellationToken cancellationToken)
    {
        IAgent? agent = await repository.FindAsync(id, cancellationToken);
        if (agent is null)
        {
            return NotFound();
        }
        var versions = await agentVersionRepository.GetByAgentAsync(agent, cancellationToken);
        return versions
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => agentDtoMapper.ToDto(v, agentVersionRepository.GetStrictFingerprint(v.SystemPrompt, v.Tools)))
            .ToArray();
    }

}
