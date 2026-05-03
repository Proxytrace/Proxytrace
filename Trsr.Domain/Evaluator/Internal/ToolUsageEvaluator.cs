using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record ToolUsageEvaluator : AbstractAgenticEvaluator, IToolUsageEvaluator
{
    public override EvaluatorKind Kind
        => EvaluatorKind.ToolUsage;
    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }

    public ToolUsageEvaluator(
        IModelEndpoint endpoint,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, repository)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.ToolUsageEvaluator);
    }

    public ToolUsageEvaluator(
        IModelEndpoint endpoint,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, existing, repository)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.ToolUsageEvaluator);
    }
}
