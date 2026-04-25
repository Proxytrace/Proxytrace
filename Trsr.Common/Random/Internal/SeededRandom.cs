namespace Trsr.Common.Random.Internal;

internal class SeededRandom : IRandom
{
    public delegate SeededRandom Factory(int seed);
    
    private readonly System.Random random;
    private readonly Lock lockObject = new();
    private readonly IReadOnlyCollection<string> words = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "honeydew", "kiwi", "lemon", "mango", "nectarine", "orange", "papaya", "quince", "raspberry", "strawberry", "tangerine", "ugli fruit", "watermelon", "xigua", "yellow passion fruit", "zucchini"];
    
    public SeededRandom(int seed)
    {
        random = new System.Random(seed);
    }

    public bool Bool()
    {
        lock (lockObject)
        {
            return random.Next(0, 2) == 1;
        }
    }

    public Guid Guid()
    {
        lock (lockObject)
        {
            var bytes = new byte[16];
            random.NextBytes(bytes);
            return new Guid(bytes);
        }
    }

    public string String() 
        => Enumerable.Range(0, Int(min: 1, max: 5))
            .Select(_ => Any(words))
            .Aggregate((a, b) => $"{a} {b}");

    public string UniqueString() 
        => Guid().ToString();

    public int Int(int? min = null, int? max = null)
    {
        lock (lockObject)
        {
            min ??= 0;
            max ??= int.MaxValue;
            return random.Next(min.Value, max.Value);
        }
    }

    public decimal Decimal(decimal? min = null, decimal? max = null)
    {
        lock (lockObject)
        {
            min ??= 0;
            max ??= decimal.MaxValue;
            var nextDecimal = (decimal)random.NextDouble();
            return min.Value + (nextDecimal * (max.Value - min.Value));
        }
    }

    public T Any<T>(IReadOnlyCollection<T> options) 
        => options.ElementAt(Int(min: 0, max: options.Count));

    public TimeSpan TimeSpan(TimeSpan? min = null, TimeSpan? max = null)
        => System.TimeSpan.FromMilliseconds(Int(min: 500, max: 5000));
}