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
        CancellationToken cancellationToken = default);

    Task<PagedResult<ITestRunGroup>> GetByProjectPagedAsync(
        Guid projectId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
