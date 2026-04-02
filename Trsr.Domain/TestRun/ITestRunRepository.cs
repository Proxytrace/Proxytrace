namespace Trsr.Domain.TestRun;

public interface ITestRunRepository : IRepository<ITestRun>
{
    Task<IReadOnlyList<ITestRun>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);
}
