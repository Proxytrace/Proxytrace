using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Auth.Licensing;
using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Tools;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[RequiresFeature(LicenseFeature.OptimizationProposals)]
[Route("api/proposals")]
public class ProposalsController : ControllerBase
{
    private readonly IOptimizationProposalRepository repository;
    private readonly IModelSwitchProposal.CreateNew createModelSwitchNew;
    private readonly ISystemPromptProposal.CreateNew createSystemPromptNew;
    private readonly IToolUpdateProposal.CreateNew createToolUpdateNew;
    private readonly IAgentRepository agents;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly IRepository<ITestSuite> suites;
    private readonly IRepository<ITestRunGroup> groups;
    private readonly IRepository<ITestRun> testRuns;
    private readonly ITestSuite.CreateNew createSuite;
    private readonly ITestRunGroup.CreateNew createGroup;
    private readonly ITestRun.CreateNew createRun;
    private readonly OptimizationProposalDtoMapper mapper;
    private readonly IProposalBroadcaster proposalBroadcaster;

    public ProposalsController(
        IOptimizationProposalRepository repository,
        IModelSwitchProposal.CreateNew createModelSwitchNew,
        ISystemPromptProposal.CreateNew createSystemPromptNew,
        IToolUpdateProposal.CreateNew createToolUpdateNew,
        IAgentRepository agents,
        IRepository<IModelEndpoint> endpoints,
        IRepository<ITestSuite> suites,
        IRepository<ITestRunGroup> groups,
        IRepository<ITestRun> testRuns,
        ITestSuite.CreateNew createSuite,
        ITestRunGroup.CreateNew createGroup,
        ITestRun.CreateNew createRun,
        OptimizationProposalDtoMapper mapper,
        IProposalBroadcaster proposalBroadcaster)
    {
        this.repository = repository;
        this.createModelSwitchNew = createModelSwitchNew;
        this.createSystemPromptNew = createSystemPromptNew;
        this.createToolUpdateNew = createToolUpdateNew;
        this.agents = agents;
        this.endpoints = endpoints;
        this.suites = suites;
        this.groups = groups;
        this.testRuns = testRuns;
        this.createSuite = createSuite;
        this.createGroup = createGroup;
        this.createRun = createRun;
        this.mapper = mapper;
        this.proposalBroadcaster = proposalBroadcaster;
    }

    [HttpGet]
    public async Task<IReadOnlyList<OptimizationProposalDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IOptimizationProposal> proposals;
        if (agentId.HasValue)
            proposals = await repository.GetByAgentAsync(agentId.Value, cancellationToken);
        else if (projectId.HasValue)
            proposals = await repository.GetByProjectAsync(projectId.Value, cancellationToken);
        else
            proposals = await repository.GetAllAsync(cancellationToken);

        return proposals.Select(mapper.ToDto).ToList();
    }

    /// <summary>
    /// Test-only: seeds an optimization proposal directly, bypassing the optimizer pipeline.
    /// Supports SystemPrompt, ModelSwitch and ToolUpdate proposals. A minimal A/B test run is
    /// created for the agent's endpoint to satisfy the proposal's mandatory evidence reference.
    /// </summary>
    [HttpPost("seed")]
    public async Task<ActionResult<OptimizationProposalDto>> Seed(
        [FromBody] SeedProposalRequest request,
        CancellationToken cancellationToken)
    {
        var agent = await agents.FindAsync(request.AgentId, cancellationToken);
        if (agent is null)
            return NotFound();

        IOptimizationProposal saved;

        switch (request.Details)
        {
            case SystemPromptDetailsDto systemPrompt:
            {
                var abTestRun = await BuildAbTestRunAsync(agent, cancellationToken);
                saved = await repository.AddAsync(
                    createSystemPromptNew(
                        agent,
                        request.Priority,
                        request.Rationale,
                        systemPrompt.ProposedSystemMessage,
                        currentPassRate: null,
                        proposedPassRate: null,
                        evidenceTestRunIds: [],
                        abTestRun: abTestRun),
                    cancellationToken);

                break;
            }

            case ModelSwitchSeedDetailsDto modelSwitch:
            {
                var proposedEndpoint = await endpoints.FindAsync(modelSwitch.ProposedEndpointId, cancellationToken);
                if (proposedEndpoint is null)
                    return BadRequest($"Proposed endpoint {modelSwitch.ProposedEndpointId} does not exist.");

                var abTestRun = await BuildAbTestRunAsync(agent, cancellationToken);
                saved = await repository.AddAsync(
                    createModelSwitchNew(
                        agent,
                        request.Priority,
                        request.Rationale,
                        proposedEndpoint,
                        currentPassRate: null,
                        proposedPassRate: null,
                        expectedCostDelta: null,
                        expectedLatencyDelta: null,
                        evidenceTestRunIds: [],
                        abTestRun: abTestRun),
                    cancellationToken);

                break;
            }

            case ToolUpdateSeedDetailsDto toolUpdate:
            {
                var proposedTools = toolUpdate.ProposedTools
                    .Select(t => new ToolSpecification(
                        t.Name,
                        t.Description,
                        string.IsNullOrWhiteSpace(t.ParametersJson)
                            ? ToolArguments.None
                            : ToolArguments.FromJsonSchema(t.ParametersJson)))
                    .ToList();

                var abTestRun = await BuildAbTestRunAsync(agent, cancellationToken);
                saved = await repository.AddAsync(
                    createToolUpdateNew(
                        agent,
                        request.Priority,
                        request.Rationale,
                        proposedTools,
                        currentPassRate: null,
                        proposedPassRate: null,
                        evidenceTestRunIds: [],
                        abTestRun: abTestRun),
                    cancellationToken);

                break;
            }

            default:
                return BadRequest("Unsupported proposal details kind.");
        }

        // CreateNew always starts in Draft; walk the domain transitions to the requested status.
        saved = request.Status switch
        {
            ProposalStatus.Accepted => await saved.Accept(cancellationToken),
            ProposalStatus.Rejected => await saved.Reject(cancellationToken),
            ProposalStatus.Adopted => await (await saved.Accept(cancellationToken))
                .MarkAdopted(null, manual: true, cancellationToken),
            _ => saved,
        };

        return Ok(mapper.ToDto(saved));
    }

    /// <summary>
    /// Builds the minimal suite + group + A/B test run a seeded proposal must reference, for the
    /// given agent's endpoint.
    /// </summary>
    private async Task<ITestRun> BuildAbTestRunAsync(IAgent agent, CancellationToken cancellationToken)
    {
        var suite = await suites.AddAsync(
            createSuite($"Seeded proposal suite {DateTimeOffset.UtcNow:O}", agent, [], []),
            cancellationToken);
        var group = await groups.AddAsync(createGroup(suite, isSystemRun: true), cancellationToken);
        return await testRuns.AddAsync(createRun(group, agent.Endpoint), cancellationToken);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<OptimizationProposalDto>> UpdateStatus(
        Guid id,
        [FromBody] UpdateProposalStatusRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await repository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();

        IOptimizationProposal updated;
        switch (request.Status)
        {
            case ProposalStatus.Accepted when existing.Status == ProposalStatus.Draft:
                updated = await existing.Accept(cancellationToken);
                break;
            case ProposalStatus.Rejected when existing.Status == ProposalStatus.Draft:
                updated = await existing.Reject(cancellationToken);
                break;
            case ProposalStatus.Adopted when existing.Status == ProposalStatus.Accepted:
                // Manual "mark adopted" — the user confirmed the change is live; no observed version.
                updated = await existing.MarkAdopted(null, manual: true, cancellationToken);
                break;
            default:
                return Conflict(new
                {
                    error = $"Cannot change proposal status from {existing.Status} to {request.Status}.",
                });
        }

        proposalBroadcaster.Publish(ProposalStatusChangedEvent.Create(updated));
        return Ok(mapper.ToDto(updated));
    }

    /// <summary>
    /// Machine-readable handoff package for applying the proposed change to the agent's actual
    /// implementation (Proxytrace only observes traffic; it cannot apply the change itself).
    /// </summary>
    [HttpGet("{id:guid}/artifact")]
    public async Task<ActionResult<ProposalArtifactDto>> GetArtifact(Guid id, CancellationToken cancellationToken)
    {
        var proposal = await repository.FindAsync(id, cancellationToken);
        if (proposal is null)
            return NotFound();

        return Ok(mapper.ToArtifactDto(proposal));
    }
}
