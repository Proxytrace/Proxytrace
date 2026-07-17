namespace Proxytrace.Domain.Session;

public interface ISessionRepository : IRepository<ISession>
{
    /// <summary>
    /// Ingestion-hot-path upsert: creates the session on first sight, otherwise bumps
    /// LastActivityAt / TraceCount / TotalTokens. Safe under concurrent ingestion.
    /// </summary>
    Task RecordActivityAsync(
        Guid sessionId,
        string externalKey,
        Guid projectId,
        long totalTokens,
        DateTimeOffset lastActivityAt,
        CancellationToken cancellationToken = default);

    /// <summary>Recent sessions of a project, most recently active first.</summary>
    Task<(IReadOnlyList<ISession> Items, int Total)> GetRecentAsync(
        Guid projectId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
