using Proxytrace.Domain.Paging;

namespace Proxytrace.Domain.TestSuite;

/// <summary>
/// Repository for <see cref="ITestSuite"/> entities with agent-scoped lookup.
/// </summary>
public interface ITestSuiteRepository : IRepository<ITestSuite>
{
    /// <summary>
    /// Returns all test suites associated with the agent identified by <paramref name="agentId"/>.
    /// </summary>
    Task<IReadOnlyList<ITestSuite>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ITestSuite>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<PagedResult<ITestSuite>> GetByAgentPagedAsync(
        Guid agentId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ITestSuite>> GetByProjectPagedAsync(
        Guid projectId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
