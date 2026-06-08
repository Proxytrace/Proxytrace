namespace Proxytrace.Domain.AgentCall;

public record AgentCallHistogramBucket(DateTimeOffset Start, int Total, int Errors);

/// <summary>
/// Buckets agent-call timestamps into a fixed number of equal-width slots spanning [from, to].
/// Each bucket carries the total call count and the count whose HTTP status indicates an error
/// (>= <see cref="ErrorStatusThreshold"/>). Pure and provider-agnostic so it runs identically over
/// PostgreSQL-sourced and in-memory rows.
/// </summary>
public static class AgentCallHistogram
{
    public const int ErrorStatusThreshold = 400;

    public static IReadOnlyList<AgentCallHistogramBucket> Build(
        IEnumerable<(DateTimeOffset CreatedAt, int HttpStatus)> calls,
        DateTimeOffset from,
        DateTimeOffset to,
        int buckets)
    {
        if (buckets < 1) throw new ArgumentOutOfRangeException(nameof(buckets));
        if (to <= from) throw new ArgumentException("to must be after from", nameof(to));

        var totals = new int[buckets];
        var errors = new int[buckets];
        var width = (to - from).Ticks / (double)buckets;

        foreach (var (createdAt, httpStatus) in calls)
        {
            if (createdAt < from || createdAt > to) continue;
            var idx = (int)((createdAt - from).Ticks / width);
            if (idx < 0) idx = 0;
            if (idx >= buckets) idx = buckets - 1;
            totals[idx]++;
            if (httpStatus >= ErrorStatusThreshold) errors[idx]++;
        }

        var result = new AgentCallHistogramBucket[buckets];
        for (var i = 0; i < buckets; i++)
            result[i] = new AgentCallHistogramBucket(from.AddTicks((long)(i * width)), totals[i], errors[i]);
        return result;
    }
}
