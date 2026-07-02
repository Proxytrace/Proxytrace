namespace Proxytrace.Domain.Statistics;

public enum StatisticsBucket
{
    FiveMinutes,
    Hourly,
    Daily,
}

public static class StatisticsTime
{
    /// <summary>
    /// UTC-aligned start of the bucket containing <paramref name="timestamp"/>. Normalizes to UTC
    /// first so a non-UTC offset cannot shift the boundaries — <see cref="WidthMilliseconds"/> and
    /// <see cref="BucketStartFromIndex"/> promise the epoch-division grouping and this method agree,
    /// which only holds when both align on UTC.
    /// </summary>
    public static DateTimeOffset BucketStart(this StatisticsBucket bucket, DateTimeOffset timestamp)
    {
        DateTimeOffset utc = timestamp.ToUniversalTime();
        return bucket switch
        {
            StatisticsBucket.FiveMinutes => new DateTimeOffset(
                utc.Year, utc.Month, utc.Day,
                utc.Hour, (utc.Minute / 5) * 5, 0, TimeSpan.Zero),
            StatisticsBucket.Hourly => new DateTimeOffset(
                utc.Year, utc.Month, utc.Day,
                utc.Hour, 0, 0, TimeSpan.Zero),
            StatisticsBucket.Daily => new DateTimeOffset(
                utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero),
            _ => utc,
        };
    }

    /// <summary>
    /// Fixed width of a bucket in milliseconds. Because every granularity divides the Unix epoch
    /// evenly (5 min, 1 h and 1 day all start on an epoch boundary), bucketing by
    /// <c>floor((CreatedAt - UnixEpoch) / width)</c> yields exactly the same UTC-aligned buckets as
    /// <see cref="BucketStart"/> — but as an integer expression a relational provider can translate
    /// to a single <c>GROUP BY</c>, so aggregation runs in the database instead of materialising
    /// every row. Pair with <see cref="BucketStartFromIndex"/> to turn a group key back into a start.
    /// </summary>
    public static double WidthMilliseconds(this StatisticsBucket bucket)
        => bucket switch
        {
            StatisticsBucket.FiveMinutes => 5 * 60 * 1000d,
            StatisticsBucket.Hourly => 60 * 60 * 1000d,
            StatisticsBucket.Daily => 24 * 60 * 60 * 1000d,
            _ => 5 * 60 * 1000d,
        };

    /// <summary>Reconstructs the (UTC) bucket start from the integer group index used in the query.</summary>
    public static DateTimeOffset BucketStartFromIndex(this StatisticsBucket bucket, long index)
        => DateTimeOffset.UnixEpoch.AddMilliseconds(index * bucket.WidthMilliseconds());

    /// <summary>
    /// Picks a bucket granularity that yields several points for the given window, so short
    /// (sub-day) ranges still render a curve instead of collapsing to a single daily bucket.
    /// </summary>
    public static StatisticsBucket ForWindow(DateTimeOffset from, DateTimeOffset to)
    {
        TimeSpan span = to - from;
        if (span <= TimeSpan.FromHours(2)) return StatisticsBucket.FiveMinutes;
        if (span <= TimeSpan.FromDays(2)) return StatisticsBucket.Hourly;
        return StatisticsBucket.Daily;
    }
}