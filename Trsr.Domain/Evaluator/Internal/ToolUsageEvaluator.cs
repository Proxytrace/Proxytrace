using JetBrains.Annotations;
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

    public ToolUsageEvaluator(IModelEndpoint endpoint)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.ToolUsageEvaluator);
    }

    public ToolUsageEvaluator(IModelEndpoint endpoint, IDomainEntityData existing) : base(existing)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.ToolUsageEvaluator);
    }
}
