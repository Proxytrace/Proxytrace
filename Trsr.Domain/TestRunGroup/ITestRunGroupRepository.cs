namespace Trsr.Domain.TestRunGroup;

public interface ITestRunGroupRepository : IRepository<ITestRunGroup>
{
    Task<IReadOnlyList<ITestRunGroup>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ITestRunGroup>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
}
