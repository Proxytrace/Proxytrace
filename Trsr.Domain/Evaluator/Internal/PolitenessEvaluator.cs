using JetBrains.Annotations;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record PolitenessEvaluator : AbstractAgenticEvaluator, IPolitenessEvaluator
{
    public override EvaluatorKind Kind
        => EvaluatorKind.Politeness;
    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }

    public PolitenessEvaluator(IModelEndpoint endpoint)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.PolitenessEvaluator);
    }

    public PolitenessEvaluator(IModelEndpoint endpoint, IDomainEntityData existing) : base(existing)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.PolitenessEvaluator);
    }
}
