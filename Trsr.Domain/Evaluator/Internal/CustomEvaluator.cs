using JetBrains.Annotations;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record CustomEvaluator : AbstractAgenticEvaluator, ICustomEvaluator
{
    public override EvaluatorKind Kind 
        => EvaluatorKind.Custom;

    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }

    public CustomEvaluator(SystemMessage systemMessage, IModelEndpoint endpoint)
    {
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }

    public CustomEvaluator(
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing) : base(existing)
    {
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }
}
