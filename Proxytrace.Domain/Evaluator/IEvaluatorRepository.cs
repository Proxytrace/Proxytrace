namespace Proxytrace.Domain.Evaluator;

/// <summary>
/// Repository for <see cref="IEvaluator"/> entities.
/// </summary>
public interface IEvaluatorRepository : IArchivableRepository<IEvaluator>
{
    Task<IReadOnlyList<IEvaluator>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
}
