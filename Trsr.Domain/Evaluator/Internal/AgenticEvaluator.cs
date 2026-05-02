using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record AgenticEvaluator : DomainEntity, IAgenticEvaluator
{
    public EvaluatorKind Kind 
        => EvaluatorKind.Agentic;

    public SystemMessage SystemMessage { get; }
    public IModelEndpoint Endpoint { get; }

    public AgenticEvaluator(SystemMessage systemMessage, IModelEndpoint endpoint)
    {
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }

    public AgenticEvaluator(
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing) : base(existing)
    {
        SystemMessage = systemMessage;
        Endpoint = endpoint;
    }

    public Task<IEvaluation> EvaluateAsync(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException();
    }
}
