using Proxytrace.Domain.Paging;

namespace Proxytrace.Domain.TestRun;

/// <summary>
/// Repository for <see cref="ITestRun"/> entities with scoped lookup methods.
/// </summary>
public interface ITestRunRepository : IRepository<ITestRun>
{
    Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ITestRun>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns all runs whose <see cref="ITestRun.Status"/> is one of <paramref name="statuses"/>.
    /// Filters in SQL so callers don't load the whole table to keep a subset.
    /// </summary>
    Task<IReadOnlyList<ITestRun>> GetByStatusAsync(
        IReadOnlyCollection<TestRunStatus> statuses,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the owning run id for each of the given test-result ids by scanning recent runs.
    /// Result ids that can't be matched to a recent run are omitted from the returned map.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, Guid>> GetRunIdsByResultIdsAsync(
        IReadOnlyCollection<Guid> resultIds,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ITestRun>> GetByAgentPagedAsync(
        Guid agentId,
        int page,
        int pageSize,
        bool includeSystem = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Pages all runs across tenants, newest first. <paramref name="includeSystem"/> false (the
    /// default) drops runs of ephemeral system run groups (A/B validation), mirroring
    /// <see cref="ITestRunGroupRepository"/>.
    /// </summary>
    Task<PagedResult<ITestRun>> GetAllPagedAsync(
        int page,
        int pageSize,
        bool includeSystem = false,
        CancellationToken cancellationToken = default);
}
