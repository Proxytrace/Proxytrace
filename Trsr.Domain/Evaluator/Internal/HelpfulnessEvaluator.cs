using Trsr.Application;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

internal record HelpfulnessEvaluator : AbstractAgenticEvaluator, IHelpfulnessEvaluator
{
    public override EvaluatorKind Kind 
        => EvaluatorKind.Helpfulness;
    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }
    
    public HelpfulnessEvaluator(
        IModelEndpoint endpoint)
    {
        Endpoint = endpoint;
        SystemMessage  = Message.Message.CreateSystemMessage(Prompts.HelpfulnessEvaluator);
    }
}
