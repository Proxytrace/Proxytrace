using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Agents;
using Trsr.Api.Dto.Proposals;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Tools;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/proposals")]
public class ProposalsController : ControllerBase
{
    private readonly IOptimizationProposalRepository repository;
    private readonly IRepository<IModelEndpoint> endpointRepository;
    private readonly IOptimizationProposal.CreateExisting createExisting;

    public ProposalsController(
        IOptimizationProposalRepository repository,
        IRepository<IModelEndpoint> endpointRepository,
        IOptimizationProposal.CreateExisting createExisting)
    {
        this.repository = repository;
        this.endpointRepository = endpointRepository;
        this.createExisting = createExisting;
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

        var dtos = new List<OptimizationProposalDto>(proposals.Count);
        foreach (var p in proposals)
            dtos.Add(await ToDtoAsync(p, cancellationToken));
        return dtos;
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
        var updated = createExisting(
            existing.Agent,
            request.Status,
            existing.Priority,
            existing.Rationale,
            existing.Details,
            existing.EvidenceTestRunIds,
            existing);
        await repository.UpdateAsync(updated, cancellationToken);
        return Ok(await ToDtoAsync(updated, cancellationToken));
    }

    private async Task<OptimizationProposalDto> ToDtoAsync(IOptimizationProposal p, CancellationToken ct)
    {
        var details = await ToDetailsDtoAsync(p, ct);
        return new OptimizationProposalDto(
            p.Id,
            p.Kind,
            p.Status,
            p.Agent.Id,
            p.Agent.Name,
            p.Priority,
            p.Rationale,
            details,
            [.. p.EvidenceTestRunIds],
            p.CreatedAt,
            p.UpdatedAt);
    }

    private async Task<ProposalDetailsDto> ToDetailsDtoAsync(IOptimizationProposal p, CancellationToken ct)
        => p.Details switch
        {
            ModelSwitchDetails ms => await ToModelSwitchDtoAsync(p.Agent, ms, ct),
            SystemPromptDetails sp => ToSystemPromptDto(p.Agent, sp),
            ToolDetails td => ToToolDto(p.Agent, td),
            _ => throw new ArgumentOutOfRangeException(nameof(p.Details)),
        };

    private async Task<ModelSwitchDetailsDto> ToModelSwitchDtoAsync(IAgent agent, ModelSwitchDetails ms, CancellationToken ct)
    {
        var proposed = await endpointRepository.GetAsync(ms.ProposedEndpointId, ct);
        return new ModelSwitchDetailsDto(
            ms.ProposedEndpointId,
            agent.Endpoint.Model.Name,
            proposed.Model.Name,
            ms.ExpectedPassRateDelta,
            ms.ExpectedCostDelta.HasValue ? (double)ms.ExpectedCostDelta.Value : null,
            ms.ExpectedLatencyDelta.HasValue ? (long)ms.ExpectedLatencyDelta.Value.TotalMilliseconds : null);
    }

    private static SystemPromptDetailsDto ToSystemPromptDto(IAgent agent, SystemPromptDetails sp)
        => new(agent.SystemPrompt.Template, sp.ProposedSystemMessage.ToString());

    private static ToolDetailsDto ToToolDto(IAgent agent, ToolDetails td)
        => new(
            [.. agent.Tools.Select(ToToolSpecDto)],
            [.. td.ProposedTools.Select(ToToolSpecDto)]);

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
        catch { }
        return new ToolArgumentDto(arg.Name, arg.Description, type, arg.IsRequired, enumValues);
    }
}
