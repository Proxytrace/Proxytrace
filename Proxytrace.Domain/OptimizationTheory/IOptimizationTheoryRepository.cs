namespace Proxytrace.Domain.OptimizationTheory;

/// <summary>
/// Repository for <see cref="IOptimizationTheory"/> entities.
/// </summary>
public interface IOptimizationTheoryRepository : IRepository<IOptimizationTheory>
{
    /// <summary>
    /// Returns all theories targeting the specified agent, ordered by creation date descending.
    /// </summary>
    Task<IReadOnlyList<IOptimizationTheory>> GetByAgentAsync(
        Guid agentId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns all theories within the specified project, ordered by creation date descending.
    /// </summary>
    Task<IReadOnlyList<IOptimizationTheory>> GetByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the most-recently-updated theory for the given agent with the specified
    /// <see cref="IOptimizationTheory.ContentHash"/>, or null if none exists. Used for dedup.
    /// </summary>
    Task<IOptimizationTheory?> FindLatestByContentHashAsync(
        Guid agentId,
        string contentHash,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts theories within a project that are currently in the given status.
    /// </summary>
    Task<int> CountByProjectAndStatusAsync(
        Guid projectId,
        TheoryStatus status,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts the in-flight theories within a project — those still queued (<see cref="TheoryStatus.Proposed"/>)
    /// or currently validating. This is the backlog that bounds the validation cost a project can incur,
    /// and is what the per-project submission quota is checked against.
    /// </summary>
    Task<int> CountActiveByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns all in-flight theories (<see cref="TheoryStatus.Proposed"/> or
    /// <see cref="TheoryStatus.Validating"/>) across every project, oldest first. Used to
    /// re-queue the validation backlog after a restart — the queue itself is in-memory, so
    /// without recovery these theories would stay in-flight forever and permanently consume
    /// their project's submission quota.
    /// </summary>
    Task<IReadOnlyList<IOptimizationTheory>> GetActiveAsync(
        CancellationToken cancellationToken = default);
}
