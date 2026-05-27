using Proxytrace.Domain.Paging;

namespace Proxytrace.Domain.TestRun;

/// <summary>
/// Repository for <see cref="ITestRun"/> entities with scoped lookup methods.
/// </summary>
public interface ITestRunRepository : IRepository<ITestRun>
{
    Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ITestRun>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);

    Task<PagedResult<ITestRun>> GetByAgentPagedAsync(
        Guid agentId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
