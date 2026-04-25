namespace Trsr.Common.Random;

public interface IRandom
{
    bool Bool();
    Guid Guid();
    string String();
    string UniqueString();
    int Int(int? min = null, int? max = null);
    decimal Decimal(decimal? min = null, decimal? max = null);
    T Any<T>(IReadOnlyCollection<T> options);
    TimeSpan TimeSpan(TimeSpan? min = null, TimeSpan? max = null);
}