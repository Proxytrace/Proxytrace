namespace Proxytrace.Storage.Internal;

/// <summary>
/// Helpers for the <see cref="DateTimeOffset"/>-based optimistic concurrency token (<c>UpdatedAt</c>).
/// </summary>
internal static class ConcurrencyTokenExtensions
{
    /// <summary>
    /// Returns whether two concurrency tokens refer to the same persisted version.
    /// PostgreSQL <c>timestamptz</c> stores microsecond precision, but a token carried in memory
    /// keeps .NET's 100-nanosecond precision (e.g. the entity returned by <c>AddAsync</c>, before any
    /// DB round-trip truncated it). Comparing the raw values would then spuriously report a conflict
    /// for the first update after an insert, so the comparison is done at microsecond granularity —
    /// the precision the database actually round-trips.
    /// </summary>
    public static bool MatchesConcurrencyToken(this DateTimeOffset stored, DateTimeOffset incoming)
        => stored.UtcTicks / TimeSpan.TicksPerMicrosecond == incoming.UtcTicks / TimeSpan.TicksPerMicrosecond;
}
