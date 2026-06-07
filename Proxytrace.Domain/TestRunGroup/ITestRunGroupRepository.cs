using Proxytrace.Domain.Paging;

namespace Proxytrace.Domain.TestRunGroup;

public interface ITestRunGroupRepository : IRepository<ITestRunGroup>
{
    Task<IReadOnlyList<ITestRunGroup>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ITestRunGroup>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<PagedResult<ITestRunGroup>> GetByAgentPagedAsync(
        Guid agentId,
        int page,
        int pageSize,
        bool includeSystem = false,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ITestRunGroup>> GetByProjectPagedAsync(
        Guid projectId,
        int page,
        int pageSize,
        bool includeSystem = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts completed test-run groups against the given agent whose <c>CompletedAt</c>
    /// is strictly after the supplied threshold.
    /// </summary>
    Task<int> CountCompletedSinceAsync(
        Guid agentId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default);
}
