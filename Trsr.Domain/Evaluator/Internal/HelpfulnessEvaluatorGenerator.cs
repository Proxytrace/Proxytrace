using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

// IHelpfulnessEvaluator.CreateNew has an incorrect return type (ICustomEvaluator), so the
// implementation is constructed directly rather than through the delegate.
internal class HelpfulnessEvaluatorGenerator : EvaluatorGeneratorBase<IHelpfulnessEvaluator>
{
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;
    private readonly IHelpfulnessEvaluator.CreateNew factory;

    public HelpfulnessEvaluatorGenerator(
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IHelpfulnessEvaluator.CreateNew factory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.modelEndpointGenerator = modelEndpointGenerator;
        this.factory = factory;
    }

    public override async Task<IHelpfulnessEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));
}
