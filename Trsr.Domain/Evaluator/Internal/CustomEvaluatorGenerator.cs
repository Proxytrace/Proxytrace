using Trsr.Common.Random;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal class CustomEvaluatorGenerator : EvaluatorGeneratorBase<ICustomEvaluator>
{
    private readonly ICustomEvaluator.CreateNew factory;
    private readonly IRandom random;
    private readonly IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator;

    public CustomEvaluatorGenerator(
        ICustomEvaluator.CreateNew factory,
        IRandom random,
        IDomainEntityGenerator<IModelEndpoint> modelEndpointGenerator,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.factory = factory;
        this.random = random;
        this.modelEndpointGenerator = modelEndpointGenerator;
    }

    public override async Task<ICustomEvaluator> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            random.String(),
            new SystemMessage([Content.FromText("Evaluate the response.")]),
            await modelEndpointGenerator.GetOrCreateAsync(cancellationToken));
}
