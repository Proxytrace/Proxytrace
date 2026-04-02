namespace Trsr.Domain.TestSuite;

/// <summary>
/// Repository for <see cref="ITestSuite"/> entities with agent-scoped lookup.
/// </summary>
public interface ITestSuiteRepository : IRepository<ITestSuite>
{
    /// <summary>
    /// Returns all test suites associated with the agent identified by <paramref name="agentId"/>.
    /// </summary>
    Task<IReadOnlyList<ITestSuite>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);
}
