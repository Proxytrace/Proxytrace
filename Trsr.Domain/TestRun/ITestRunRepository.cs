namespace Trsr.Domain.TestRun;

/// <summary>
/// Repository for <see cref="ITestRun"/> entities with scoped lookup methods.
/// </summary>
public interface ITestRunRepository : IRepository<ITestRun>
{
    Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ITestRun>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
}
