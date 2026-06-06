namespace Proxytrace.Application.Statistics;

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