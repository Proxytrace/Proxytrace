using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
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

    public SafetyClassifier(
        IModelEndpoint endpoint,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, repository)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.SafetyClassifier);
    }

    public SafetyClassifier(
        IModelEndpoint endpoint,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, existing, repository)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.SafetyClassifier);
    }
}
