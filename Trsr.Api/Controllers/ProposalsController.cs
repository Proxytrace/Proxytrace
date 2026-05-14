using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Agents;
using Trsr.Api.Dto.Proposals;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Tools;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/proposals")]
public class ProposalsController : ControllerBase
{
    private readonly IOptimizationProposalRepository repository;
    private readonly IModelSwitchProposal.CreateExisting createModelSwitch;
    private readonly ISystemPromptProposal.CreateExisting createSystemPrompt;
    private readonly IToolUpdateProposal.CreateExisting createToolUpdate;

    public ProposalsController(
        IOptimizationProposalRepository repository,
        IModelSwitchProposal.CreateExisting createModelSwitch,
        ISystemPromptProposal.CreateExisting createSystemPrompt,
        IToolUpdateProposal.CreateExisting createToolUpdate)
    {
        this.repository = repository;
        this.createModelSwitch = createModelSwitch;
        this.createSystemPrompt = createSystemPrompt;
        this.createToolUpdate = createToolUpdate;
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

        return proposals.Select(ToDto).ToList();
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<OptimizationProposalDto>> UpdateStatus(
        Guid id,
        [FromBody] UpdateProposalStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();

        var existing = await repository.GetAsync(id, cancellationToken);
        IOptimizationProposal updated = existing switch
        {
            IModelSwitchProposal ms => createModelSwitch(
                ms.Agent, request.Status, ms.Priority, ms.Rationale,
                ms.ProposedEndpoint, ms.ExpectedPassRateDelta, ms.ExpectedCostDelta, ms.ExpectedLatencyDelta,
                ms.EvidenceTestRunIds, ms.ABTestRun, ms),
            ISystemPromptProposal sp => createSystemPrompt(
                sp.Agent, request.Status, sp.Priority, sp.Rationale,
                sp.ProposedSystemMessage, sp.EvidenceTestRunIds, sp.ABTestRun, sp),
            IToolUpdateProposal tu => createToolUpdate(
                tu.Agent, request.Status, tu.Priority, tu.Rationale,
                tu.ProposedTools, tu.EvidenceTestRunIds, tu.ABTestRun, tu),
            _ => throw new ArgumentOutOfRangeException(nameof(existing))
        };
        await repository.UpdateAsync(updated, cancellationToken);
        return Ok(ToDto(updated));
    }

    private static OptimizationProposalDto ToDto(IOptimizationProposal p)
        => new(
            p.Id,
            p.Kind,
            p.Status,
            p.Agent.Id,
            p.Agent.Name,
            p.Priority,
            p.Rationale,
            ToDetailsDto(p),
            [.. p.EvidenceTestRunIds],
            p.CreatedAt,
            p.UpdatedAt);

    private static ProposalDetailsDto ToDetailsDto(IOptimizationProposal p)
        => p switch
        {
            IModelSwitchProposal ms => ToModelSwitchDto(ms),
            ISystemPromptProposal sp => ToSystemPromptDto(sp),
            IToolUpdateProposal tu => ToToolDto(tu),
            _ => throw new ArgumentOutOfRangeException(nameof(p)),
        };

    private static ModelSwitchDetailsDto ToModelSwitchDto(IModelSwitchProposal ms)
        => new(
            ms.ProposedEndpoint.Id,
            ms.Agent.Endpoint.Model.Name,
            ms.ProposedEndpoint.Model.Name,
            ms.ExpectedPassRateDelta,
            ms.ExpectedCostDelta.HasValue ? (double)ms.ExpectedCostDelta.Value : null,
            ms.ExpectedLatencyDelta.HasValue ? (long)ms.ExpectedLatencyDelta.Value.TotalMilliseconds : null);

    private static SystemPromptDetailsDto ToSystemPromptDto(ISystemPromptProposal sp)
        => new(sp.Agent.SystemPrompt.Template, sp.ProposedSystemMessage);

    private static ToolDetailsDto ToToolDto(IToolUpdateProposal tu)
        => new(
            [.. tu.Agent.Tools.Select(ToToolSpecDto)],
            [.. tu.ProposedTools.Select(ToToolSpecDto)]);

    private static ToolSpecificationDto ToToolSpecDto(ToolSpecification t)
        => new(t.Name, t.Description, [.. t.Arguments.Arguments.Select(ToArgumentDto)]);

    private static ToolArgumentDto ToArgumentDto(IToolArgument arg)
    {
        var type = "object";
        List<string>? enumValues = null;
        try
        {
            using var doc = JsonDocument.Parse(arg.JsonSchema);
            var root = doc.RootElement;
            if (root.TryGetProperty("type", out var typeEl))
                type = typeEl.GetString() ?? "object";
            if (root.TryGetProperty("enum", out var enumEl) && enumEl.ValueKind == JsonValueKind.Array)
                enumValues = [.. enumEl.EnumerateArray().Select(e => e.GetString() ?? "")];
        }
        catch
        {
            // ignored
        }

        return new ToolArgumentDto(arg.Name, arg.Description, type, arg.IsRequired, enumValues);
    }
}
