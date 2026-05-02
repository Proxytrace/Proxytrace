using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class AgenticEvaluatorGenerator : EvaluatorGeneratorBase<ICustomEvaluator>
{
    private readonly ICustomEvaluator.CreateNew factory;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;

    public AgenticEvaluatorGenerator(
        ICustomEvaluator.CreateNew factory,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.modelEndpointGenerator = modelEndpointGenerator;
    }

    public override async Task<ICustomEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            new SystemMessage([Content.FromText("Evaluate the response.")]),
            await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));
}
