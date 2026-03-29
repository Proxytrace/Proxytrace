namespace Trsr.Common.Random;

public interface IRandom
{
    public bool Bool();
    public Guid Guid();
    public string String();
    public string UniqueString();
    public int Int(int? min = null, int? max = null);
    public T Any<T>(IReadOnlyCollection<T> options);
    public TimeSpan TimeSpan(TimeSpan? min = null, TimeSpan? max = null);
}