namespace Proxytrace.Domain.Evaluator;

/// <summary>
/// Repository for <see cref="IEvaluator"/> entities.
/// </summary>
public interface IEvaluatorRepository : IArchivableRepository<IEvaluator>
{
    Task<IReadOnlyList<IEvaluator>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the id of the project the evaluator belongs to, or <see langword="null"/> if the
    /// evaluator does not exist. A cheap FK projection used to attribute audit events to a project.
    /// </summary>
    Task<Guid?> GetProjectIdAsync(Guid evaluatorId, CancellationToken cancellationToken = default);
}
