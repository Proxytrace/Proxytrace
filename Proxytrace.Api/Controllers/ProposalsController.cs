using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Domain.OptimizationProposal;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/proposals")]
public class ProposalsController : ControllerBase
{
    private readonly IOptimizationProposalRepository repository;
    private readonly IModelSwitchProposal.CreateExisting createModelSwitch;
    private readonly ISystemPromptProposal.CreateExisting createSystemPrompt;
    private readonly IToolUpdateProposal.CreateExisting createToolUpdate;
    private readonly OptimizationProposalDtoMapper mapper;

    public ProposalsController(
        IOptimizationProposalRepository repository,
        IModelSwitchProposal.CreateExisting createModelSwitch,
        ISystemPromptProposal.CreateExisting createSystemPrompt,
        IToolUpdateProposal.CreateExisting createToolUpdate,
        OptimizationProposalDtoMapper mapper)
    {
        this.repository = repository;
        this.createModelSwitch = createModelSwitch;
        this.createSystemPrompt = createSystemPrompt;
        this.createToolUpdate = createToolUpdate;
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
                ms.EvidenceTestRunIds, ms.ABTestRun, ms),
            ISystemPromptProposal sp => createSystemPrompt(
                sp.Agent, request.Status, sp.Priority, sp.Rationale,
                sp.ProposedSystemMessage, sp.CurrentPassRate, sp.ProposedPassRate,
                sp.EvidenceTestRunIds, sp.ABTestRun, sp),
            IToolUpdateProposal tu => createToolUpdate(
                tu.Agent, request.Status, tu.Priority, tu.Rationale,
                tu.ProposedTools, tu.CurrentPassRate, tu.ProposedPassRate,
                tu.EvidenceTestRunIds, tu.ABTestRun, tu),
            _ => throw new ArgumentOutOfRangeException(nameof(existing))
        };
        await repository.UpdateAsync(updated, cancellationToken);
        return Ok(mapper.ToDto(updated));
    }
}
