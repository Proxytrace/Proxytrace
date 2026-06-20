using System.ComponentModel;
using ModelContextProtocol;
using ModelContextProtocol.Server;
using Proxytrace.Api.Dto.Theories;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Mcp.Tools;

/// <summary>
/// MCP tools for reading optimization theories (A/B-validated change hypotheses) in the current project.
/// Gated by the <see cref="LicenseFeature.OptimizationProposals"/> license feature.
/// </summary>
[McpServerToolType]
internal sealed class TheoryTools
{
    private readonly IMcpProjectAccessor project;
    private readonly IOptimizationTheoryRepository repository;
    private readonly TheoryDtoMapper mapper;
    private readonly ILicenseService license;

    public TheoryTools(
        IMcpProjectAccessor project,
        IOptimizationTheoryRepository repository,
        TheoryDtoMapper mapper,
        ILicenseService license)
    {
        this.project = project;
        this.repository = repository;
        this.mapper = mapper;
        this.license = license;
    }

    [McpServerTool(Name = "list_theories")]
    [Description("List optimization theories in the current project, with each one's status, rationale and " +
                 "A/B validation outcome. Optionally filter by status.")]
    public async Task<IReadOnlyList<TheoryDto>> ListTheories(
        [Description("Optional status filter: Proposed, Validating, Validated or Invalidated.")] TheoryStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        EnsureFeature();
        var p = await project.GetProjectAsync(cancellationToken);
        IReadOnlyList<IOptimizationTheory> theories = await repository.GetByProjectAsync(p.Id, cancellationToken);
        if (status.HasValue)
            theories = theories.Where(t => t.Status == status.Value).ToList();
        return theories.Select(mapper.ToDto).ToArray();
    }

    [McpServerTool(Name = "get_theory")]
    [Description("Get a single optimization theory by id. It must belong to the current project.")]
    public async Task<TheoryDto> GetTheory(
        [Description("The theory id (GUID), from list_theories.")] Guid theoryId,
        CancellationToken cancellationToken)
    {
        EnsureFeature();
        var p = await project.GetProjectAsync(cancellationToken);
        var theory = await repository.FindAsync(theoryId, cancellationToken);
        if (theory is null || theory.Agent.Project.Id != p.Id)
            throw new McpException($"Theory '{theoryId}' was not found in this project.");
        return mapper.ToDto(theory);
    }

    private void EnsureFeature()
    {
        if (!license.IsFeatureEnabled(LicenseFeature.OptimizationProposals))
            throw new McpException("Optimization theories are not available on the current license tier.");
    }
}
