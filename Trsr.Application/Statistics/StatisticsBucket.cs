namespace Trsr.Application.Statistics;

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
}