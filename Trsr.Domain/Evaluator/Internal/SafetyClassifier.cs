using JetBrains.Annotations;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record SafetyClassifier : AbstractAgenticEvaluator, ISafetyClassifier
{
    public override EvaluatorKind Kind
        => EvaluatorKind.Safety;
    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }

    public SafetyClassifier(IModelEndpoint endpoint)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.SafetyClassifier);
    }

    public SafetyClassifier(IModelEndpoint endpoint, IDomainEntityData existing) : base(existing)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.SafetyClassifier);
    }
}
