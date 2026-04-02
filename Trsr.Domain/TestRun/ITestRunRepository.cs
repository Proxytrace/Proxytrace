namespace Trsr.Domain.TestRun;

/// <summary>
/// Repository for <see cref="ITestRun"/> entities with agent-scoped lookup.
/// </summary>
public interface ITestRunRepository : IRepository<ITestRun>
{
    /// <summary>
    /// Returns all test runs for the agent with the given <paramref name="agentId"/>.
    /// </summary>
    Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);
}
