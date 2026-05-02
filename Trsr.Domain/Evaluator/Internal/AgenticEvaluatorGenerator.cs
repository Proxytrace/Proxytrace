using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class AgenticEvaluatorGenerator : IDomainEntityGenerator<ICustomEvaluator>
{
    private readonly ICustomEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;
    private readonly IRepository<IEvaluator> repository;

    public AgenticEvaluatorGenerator(
        ICustomEvaluator.CreateNew factory,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository)
    {
        this.factory = factory;
        this.modelEndpointGenerator = modelEndpointGenerator;
        this.repository = repository;
    }

    public async Task<ICustomEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            new SystemMessage([Content.FromText("Evaluate the response.")]),
            await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));

    public async Task<ICustomEvaluator> CreateAsync(CancellationToken cancellationToken = default)
    {
        var instance = await GenerateAsync(cancellationToken);
        return (ICustomEvaluator)await repository.AddAsync(instance, cancellationToken);
    }

    public async Task<ICustomEvaluator> GetOrCreateAsync(CancellationToken cancellationToken = default)
    {
        var existing = await repository.FindFirstAsync(cancellationToken);
        if (existing is ICustomEvaluator agenticEvaluator)
            return agenticEvaluator;
        return await CreateAsync(cancellationToken);
    }
}
