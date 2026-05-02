using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class ToolUsageEvaluatorGenerator : EvaluatorGeneratorBase<IToolUsageEvaluator>
{
    private readonly IToolUsageEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;

    public ToolUsageEvaluatorGenerator(
        IToolUsageEvaluator.CreateNew factory,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.modelEndpointGenerator = modelEndpointGenerator;
    }

    public override async Task<IToolUsageEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));
}
