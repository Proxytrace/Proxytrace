using Proxytrace.Domain.Project;

namespace Proxytrace.Domain.AgentCall;

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
    /// Same filter/paging as <see cref="GetFilteredAsync"/> but returns the lightweight
    /// <see cref="AgentCallListItem"/> projection for the traces table: the query reads only scalar
    /// row columns (never the request/response/model-parameter payloads) so a page does not
    /// deserialise — nor ship over the wire — potentially huge conversation JSON for every row.
    /// </summary>
    Task<(IReadOnlyList<AgentCallListItem> Items, int Total)> GetFilteredListAsync(
        AgentCallFilter filter,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Buckets matching calls into <paramref name="buckets"/> equal-width time slots spanning the
    /// filter window. When <see cref="AgentCallFilter.From"/> is null the window starts at the
    /// earliest matching call; when <see cref="AgentCallFilter.To"/> is null it ends at "now".
    /// Returns an empty list when nothing matches.
    /// </summary>
    Task<IReadOnlyList<AgentCallHistogramBucket>> GetHistogramAsync(
        AgentCallFilter filter,
        int buckets,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the timestamp of the most recent call for each agent, keyed by agent ID.
    /// Agents with no calls are omitted.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetLastCallTimesAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the most recently created call for the given conversation, or <see langword="null"/> if none exists.
    /// </summary>
    Task<IAgentCall?> FindLatestByConversationIdAsync(
        Guid conversationId,
        IProject project,
        CancellationToken cancellationToken = default);

    Task<int> RemoveOlderThanAsync(DateTimeOffset cutoffDate, CancellationToken cancellationToken);
}
