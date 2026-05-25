namespace Proxytrace.Domain.OptimizationProposal.Internal;

internal abstract class OptimizationProposalGeneratorBase<T> : IDomainEntityGenerator<T>
    where T : class, IOptimizationProposal
{
    private readonly IRepository<IOptimizationProposal> repository;

    protected OptimizationProposalGeneratorBase(IRepository<IOptimizationProposal> repository)
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
