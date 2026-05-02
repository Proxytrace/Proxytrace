using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class PolitenessEvaluatorGenerator : EvaluatorGeneratorBase<IPolitenessEvaluator>
{
    private readonly IPolitenessEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;

    public PolitenessEvaluatorGenerator(
        IPolitenessEvaluator.CreateNew factory,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.modelEndpointGenerator = modelEndpointGenerator;
    }

    public override async Task<IPolitenessEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));
}
