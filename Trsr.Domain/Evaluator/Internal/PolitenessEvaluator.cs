using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
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

    public PolitenessEvaluator(
        IModelEndpoint endpoint,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, repository)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.PolitenessEvaluator);
    }

    public PolitenessEvaluator(
        IModelEndpoint endpoint,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(evaluationFactory, existing, repository)
    {
        Endpoint = endpoint;
        SystemMessage = Message.Message.CreateSystemMessage(Prompts.PolitenessEvaluator);
    }
}
