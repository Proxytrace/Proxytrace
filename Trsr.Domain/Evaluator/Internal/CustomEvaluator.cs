using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
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

    public CustomEvaluator(
        string name,
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, repository)
    {
        Name = name;
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }

    public CustomEvaluator(
        string name,
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, existing, repository)
    {
        Name = name;
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }
}
