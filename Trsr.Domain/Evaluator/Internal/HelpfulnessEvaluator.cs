using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

internal record HelpfulnessEvaluator : AbstractAgenticEvaluator, IHelpfulnessEvaluator
{
    public override EvaluatorKind Kind 
        => EvaluatorKind.Helpfulness;
    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }
    
    public HelpfulnessEvaluator(
        IModelEndpoint endpoint,
        IEvaluation.Create evaluationFactory) : base(evaluationFactory)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.HelpfulnessEvaluator);
    }

    public HelpfulnessEvaluator(
        IModelEndpoint endpoint,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory) : base(evaluationFactory, existing)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.HelpfulnessEvaluator);
    }
}
