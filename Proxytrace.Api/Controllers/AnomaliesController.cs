using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Paging;

namespace Proxytrace.Api.Controllers;

/// <summary>
/// Read API for the anomaly dashboard. An anomaly is an agent call whose <see cref="OutlierFlags"/>
/// bitmask is non-zero — flagged statistically at ingestion or by a custom detector — so the recent
/// list is the traces list query with the outlier-only filter (served by the partial outlier index),
/// not a separate query path. The bucketed timeline lives on <c>StatisticsController</c>.
/// </summary>
[ApiController]
[Authorize]
[Route("api/anomalies")]
public class AnomaliesController : ControllerBase
{
    private readonly IAgentCallRepository repository;
    private readonly IAgentRepository agentRepository;
    private readonly AgentCallDtoMapper agentCallDtoMapper;
    private readonly IProjectAccessGuard accessGuard;

    public AnomaliesController(
        IAgentCallRepository repository,
        IAgentRepository agentRepository,
        AgentCallDtoMapper agentCallDtoMapper,
        IProjectAccessGuard accessGuard)
    {
        this.repository = repository;
        this.agentRepository = agentRepository;
        this.agentCallDtoMapper = agentCallDtoMapper;
        this.accessGuard = accessGuard;
    }

    // Same scoping rule as AgentCallsController.GetAll (#193): admins (accessible == null) may run
    // any query; non-admins must scope to a project they belong to — directly via projectId or via
    // the agent's project — otherwise the list returns nothing rather than leaking other tenants' rows.
    private async Task<bool> CanListAsync(Guid? projectId, Guid? agentId, CancellationToken cancellationToken)
    {
        var accessible = await accessGuard.GetAccessibleProjectIdsAsync(cancellationToken);
        if (accessible is null)
            return true;
        if (projectId is { } pid)
            return accessible.Contains(pid);
        if (agentId is { } aid)
        {
            var agent = await agentRepository.FindAsync(aid, cancellationToken);
            return agent is not null && accessible.Contains(agent.Project.Id);
        }
        return false;
    }

    /// <summary>
    /// Most recent flagged calls, newest first, in the same list-item shape as the traces table.
    /// </summary>
    [HttpGet("recent")]
    public async Task<PagedResult<AgentCallListItemDto>> GetRecent(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Clamp(page, pageSize);
        if (!await CanListAsync(projectId, agentId, cancellationToken))
            return new PagedResult<AgentCallListItemDto>([], 0, page, pageSize);
        var filter = new AgentCallFilter(AgentId: agentId, ProjectId: projectId, OutlierOnly: true);
        var (items, total) = await repository.GetFilteredListAsync(filter, page, pageSize, cancellationToken);
        return new PagedResult<AgentCallListItem>(items, total, page, pageSize).Map(agentCallDtoMapper.ToListItemDto);
    }
}
