namespace Proxytrace.Domain.OptimizationTheory.Internal;

internal abstract class OptimizationTheoryGeneratorBase<T> : IDomainEntityGenerator<T>
    where T : class, IOptimizationTheory
{
    private readonly IRepository<IOptimizationTheory> repository;

    protected OptimizationTheoryGeneratorBase(IRepository<IOptimizationTheory> repository)
    {
        this.repository = repository;
    }

    public abstract Task<T> GenerateAsync(CancellationToken cancellationToken = default);

    public async Task<T> CreateAsync(CancellationToken cancellationToken = default)
    {
        var instance = await GenerateAsync(cancellationToken);
        return (T)await repository.AddAsync(instance, cancellationToken);
    }

    public async Task<T> GetOrCreateAsync(CancellationToken cancellationToken = default)
    {
        var existing = await repository.FindFirstAsync(cancellationToken);
        if (existing is T match)
            return match;
        return await CreateAsync(cancellationToken);
    }
}
