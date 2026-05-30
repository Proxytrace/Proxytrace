using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Auth.Licensing;
using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[RequiresFeature(LicenseFeature.OptimizationProposals)]
[Route("api/proposals")]
public class ProposalsController : ControllerBase
{
    private readonly IOptimizationProposalRepository repository;
    private readonly IModelSwitchProposal.CreateExisting createModelSwitch;
    private readonly ISystemPromptProposal.CreateExisting createSystemPrompt;
    private readonly ISystemPromptProposal.CreateNew createSystemPromptNew;
    private readonly IToolUpdateProposal.CreateExisting createToolUpdate;
    private readonly IAgentRepository agents;
    private readonly IRepository<ITestSuite> suites;
    private readonly IRepository<ITestRunGroup> groups;
    private readonly IRepository<ITestRun> testRuns;
    private readonly ITestSuite.CreateNew createSuite;
    private readonly ITestRunGroup.CreateNew createGroup;
    private readonly ITestRun.CreateNew createRun;
    private readonly OptimizationProposalDtoMapper mapper;

    public ProposalsController(
        IOptimizationProposalRepository repository,
        IModelSwitchProposal.CreateExisting createModelSwitch,
        ISystemPromptProposal.CreateExisting createSystemPrompt,
        ISystemPromptProposal.CreateNew createSystemPromptNew,
        IToolUpdateProposal.CreateExisting createToolUpdate,
        IAgentRepository agents,
        IRepository<ITestSuite> suites,
        IRepository<ITestRunGroup> groups,
        IRepository<ITestRun> testRuns,
        ITestSuite.CreateNew createSuite,
        ITestRunGroup.CreateNew createGroup,
        ITestRun.CreateNew createRun,
        OptimizationProposalDtoMapper mapper)
    {
        this.repository = repository;
        this.createModelSwitch = createModelSwitch;
        this.createSystemPrompt = createSystemPrompt;
        this.createSystemPromptNew = createSystemPromptNew;
        this.createToolUpdate = createToolUpdate;
        this.agents = agents;
        this.suites = suites;
        this.groups = groups;
        this.testRuns = testRuns;
        this.createSuite = createSuite;
        this.createGroup = createGroup;
        this.createRun = createRun;
        this.mapper = mapper;
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
    /// Only SystemPrompt proposals are supported. A minimal A/B test run is created for the
    /// agent's endpoint to satisfy the proposal's mandatory evidence reference.
    /// </summary>
    [HttpPost("seed")]
    public async Task<ActionResult<OptimizationProposalDto>> Seed(
        [FromBody] SeedProposalRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Details is not SystemPromptDetailsDto details)
            return BadRequest("Only SystemPrompt proposals can be seeded.");

        var agent = await agents.FindAsync(request.AgentId, cancellationToken);
        if (agent is null)
            return NotFound();

        // A proposal must reference an A/B test run; build a minimal one for the agent's endpoint.
        var suite = await suites.AddAsync(
            createSuite($"Seeded proposal suite {DateTimeOffset.UtcNow:O}", agent, [], []),
            cancellationToken);
        var group = await groups.AddAsync(createGroup(suite), cancellationToken);
        var abTestRun = await testRuns.AddAsync(createRun(group, agent.Endpoint), cancellationToken);

        IOptimizationProposal saved = await repository.AddAsync(
            createSystemPromptNew(
                agent,
                request.Priority,
                request.Rationale,
                details.ProposedSystemMessage,
                currentPassRate: null,
                proposedPassRate: null,
                evidenceTestRunIds: [],
                abTestRun: abTestRun),
            cancellationToken);

        // CreateNew always starts in Draft; transition to the requested status if different.
        if (request.Status != ProposalStatus.Draft && saved is ISystemPromptProposal sp)
        {
            saved = createSystemPrompt(
                sp.Agent, request.Status, sp.Priority, sp.Rationale,
                sp.ProposedSystemMessage, sp.CurrentPassRate, sp.ProposedPassRate,
                sp.EvidenceTestRunIds, sp.ABTestRun, sp.ContentHash, sp);
            await repository.UpdateAsync(saved, cancellationToken);
        }

        return Ok(mapper.ToDto(saved));
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

        IOptimizationProposal updated = existing switch
        {
            IModelSwitchProposal ms => createModelSwitch(
                ms.Agent, request.Status, ms.Priority, ms.Rationale,
                ms.ProposedEndpoint, ms.CurrentPassRate, ms.ProposedPassRate, ms.ExpectedCostDelta, ms.ExpectedLatencyDelta,
                ms.EvidenceTestRunIds, ms.ABTestRun, ms.ContentHash, ms),
            ISystemPromptProposal sp => createSystemPrompt(
                sp.Agent, request.Status, sp.Priority, sp.Rationale,
                sp.ProposedSystemMessage, sp.CurrentPassRate, sp.ProposedPassRate,
                sp.EvidenceTestRunIds, sp.ABTestRun, sp.ContentHash, sp),
            IToolUpdateProposal tu => createToolUpdate(
                tu.Agent, request.Status, tu.Priority, tu.Rationale,
                tu.ProposedTools, tu.CurrentPassRate, tu.ProposedPassRate,
                tu.EvidenceTestRunIds, tu.ABTestRun, tu.ContentHash, tu),
            _ => throw new ArgumentOutOfRangeException(nameof(existing))
        };
        await repository.UpdateAsync(updated, cancellationToken);
        return Ok(mapper.ToDto(updated));
    }
}
