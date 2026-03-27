namespace Trsr.Common.Random.Internal;

internal class SeededRandom
{
    private readonly System.Random random;
    
    public SeededRandom(int seed)
    {
        random = new System.Random(seed);
    }
}