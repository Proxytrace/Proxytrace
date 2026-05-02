using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

internal record ExactMatchEvaluator : DomainEntity, IEvaluator
{
    public EvaluatorKind Kind => EvaluatorKind.ExactMatch;

    public ExactMatchEvaluator()
    {
    }

    public ExactMatchEvaluator(IDomainEntityData existing) : base(existing)
    {
    }
    
    public Task<Evaluation> EvaluateAsync(AssistantMessage expected, AssistantMessage actual, CancellationToken cancellationToken = default)
    {
        var pairs = expected.Contents.Zip(actual.Contents, (e, a) => (Expected: e, Actual: a));
        var allMatch = pairs.All(p => p.Expected.Equals(p.Actual));
        var evaluation = allMatch 
            ? Evaluation.Pass
            : Evaluation.Fail;
        return Task.FromResult(evaluation);
    }
}
