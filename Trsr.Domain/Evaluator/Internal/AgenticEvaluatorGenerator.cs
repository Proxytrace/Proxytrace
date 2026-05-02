using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class AgenticEvaluatorGenerator : IDomainEntityGenerator<IAgenticEvaluator>
{
    private readonly IAgenticEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;
    private readonly IRepository<IEvaluator> repository;

    public AgenticEvaluatorGenerator(
        IAgenticEvaluator.CreateNew factory,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository)
    {
        this.factory = factory;
        this.modelEndpointGenerator = modelEndpointGenerator;
        this.repository = repository;
    }

    public async Task<IAgenticEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            new SystemMessage([Content.FromText("Evaluate the response.")]),
            await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));

    public async Task<IAgenticEvaluator> CreateAsync(CancellationToken cancellationToken = default)
    {
        var instance = await GenerateAsync(cancellationToken);
        return (IAgenticEvaluator)await repository.AddAsync(instance, cancellationToken);
    }

    public async Task<IAgenticEvaluator> GetOrCreateAsync(CancellationToken cancellationToken = default)
    {
        var existing = await repository.FindFirstAsync(cancellationToken);
        if (existing is IAgenticEvaluator agenticEvaluator)
            return agenticEvaluator;
        return await CreateAsync(cancellationToken);
    }
}
