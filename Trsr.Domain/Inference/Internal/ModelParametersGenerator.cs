using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.Inference.Internal;

internal sealed class ModelParametersGenerator : DomainObjectGenerator<IModelParameters>
{
    private readonly IModelParameters.Create factory;

    public ModelParametersGenerator(
        IRandom random,
        IModelParameters.Create factory) : base(random)
    {
        this.factory = factory;
    }

    public override Task<IModelParameters> CreateAsync(CancellationToken cancellationToken = default)
        => factory(
            temperature: Random.Double(min: 0.7, max: 0.9),
            topP: Random.Double(min: 0.7, max: 0.9),
            reasoningEffort: Random.Any(["none", "low", "medium", "high"]),
            frequencyPenalty: Random.Double(min: 0.0, max: 0.5),
            presencePenalty: Random.Double(min: 0.0, max: 0.5),
            maxTokens: Random.Int(min: 50, max: 200)
            ).ToTaskResult();
}
