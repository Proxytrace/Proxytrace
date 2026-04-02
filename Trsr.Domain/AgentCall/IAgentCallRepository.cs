namespace Trsr.Domain.AgentCall;

public interface IAgentCallRepository : IRepository<IAgentCall>
{
    Task<(IReadOnlyList<IAgentCall> Items, int Total)> GetFilteredAsync(
        AgentCallFilter filter,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
