namespace Trsr.Domain.AgentCall;

/// <summary>
/// Repository for <see cref="IAgentCall"/> entities with paginated filtering support.
/// </summary>
public interface IAgentCallRepository : IRepository<IAgentCall>
{
    /// <summary>
    /// Returns a paginated, filtered list of agent calls together with the total count of matching records.
    /// </summary>
    Task<(IReadOnlyList<IAgentCall> Items, int Total)> GetFilteredAsync(
        AgentCallFilter filter,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the timestamp of the most recent call for each agent, keyed by agent ID.
    /// Agents with no calls are omitted.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetLastCallTimesAsync(
        CancellationToken cancellationToken = default);
}
