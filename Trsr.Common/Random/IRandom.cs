namespace Trsr.Common.Random;

public interface IRandom
{
    bool Bool();
    Guid Guid();
    string String();
    string UniqueString();
    string Email();
    Uri Uri();
    int Int(int? min = null, int? max = null);
    long Long(long? min = null, long? max = null);
    double Double(double? min = null, double? max = null);
    decimal Decimal(decimal? min = null, decimal? max = null);
    T Any<T>(IReadOnlyCollection<T> options);
    T Enum<T>() where T : struct, Enum;
    TimeSpan TimeSpan(TimeSpan? min = null, TimeSpan? max = null);
    DateTimeOffset DateTimeOffset(DateTimeOffset? min = null, DateTimeOffset? max = null);
}