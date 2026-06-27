namespace Proxytrace.Domain.Statistics;

public enum StatisticsBucket
{
    FiveMinutes,
    Hourly,
    Daily,
}

public static class StatisticsTime
{
    public static DateTimeOffset BucketStart(this StatisticsBucket bucket, DateTimeOffset timestamp)
        => bucket switch
        {
            StatisticsBucket.FiveMinutes => new DateTimeOffset(
                timestamp.Year, timestamp.Month, timestamp.Day,
                timestamp.Hour, (timestamp.Minute / 5) * 5, 0, timestamp.Offset),
            StatisticsBucket.Hourly => new DateTimeOffset(
                timestamp.Year, timestamp.Month, timestamp.Day,
                timestamp.Hour, 0, 0, timestamp.Offset),
            StatisticsBucket.Daily => new DateTimeOffset(
                timestamp.Year, timestamp.Month, timestamp.Day, 0, 0, 0, timestamp.Offset),
            _ => timestamp,
        };

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