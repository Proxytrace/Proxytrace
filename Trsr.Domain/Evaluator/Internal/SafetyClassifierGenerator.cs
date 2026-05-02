using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class SafetyClassifierGenerator : EvaluatorGeneratorBase<ISafetyClassifier>
{
    private readonly ISafetyClassifier.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;

    public SafetyClassifierGenerator(
        ISafetyClassifier.CreateNew factory,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.modelEndpointGenerator = modelEndpointGenerator;
    }

    public override async Task<ISafetyClassifier> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));
}
