namespace Trsr.Domain.TestSuite;

public interface ITestSuiteRepository : IRepository<ITestSuite>
{
    Task<IReadOnlyList<ITestSuite>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);
}
