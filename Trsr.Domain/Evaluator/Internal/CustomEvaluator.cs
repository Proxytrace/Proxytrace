using JetBrains.Annotations;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record CustomEvaluator : AbstractAgenticEvaluator, ICustomEvaluator
{
    public override EvaluatorKind Kind
        => EvaluatorKind.Custom;

    public string Name { get; }
    public override SystemMessage SystemMessage { get; }
    public override IModelEndpoint Endpoint { get; }

    public CustomEvaluator(string name, SystemMessage systemMessage, IModelEndpoint endpoint)
    {
        Name = name;
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }

    public CustomEvaluator(
        string name,
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing) : base(existing)
    {
        Name = name;
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }
}
