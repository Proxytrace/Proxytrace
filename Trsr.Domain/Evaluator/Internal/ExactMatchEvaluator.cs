using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record ExactMatchEvaluator : DomainEntity, IExactMatchEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;

    public EvaluatorKind Kind
        => EvaluatorKind.ExactMatch;

    public ExactMatchEvaluator(IEvaluation.Create evaluationFactory)
    {
        this.evaluationFactory = evaluationFactory;
    }

    public ExactMatchEvaluator(
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory) : base(existing)
    {
        this.evaluationFactory = evaluationFactory;
    }

    /// <summary>
    /// Evaluates the actual output against the expected output, given the input conversation.
    /// </summary>
    public Task<IEvaluation> EvaluateAsync(
        ITestResult testResult,
        CancellationToken cancellationToken = default)
    {
        var expectedOutput = testResult.TestCase.ExpectedOutput;
        var actualOutput = testResult.ActualResponse;
        var pairs = expectedOutput.Contents.Zip(actualOutput.Contents, (e, a) => (Expected: e, Actual: a));
        var differences = pairs.Where(p => !p.Expected.Equals(p.Actual)).ToArray();
        
        EvaluationScore score;
        string? reasoning = null;
        if (differences.Length > 0)
        {
            score = EvaluationScore.Terrible;
            reasoning = string.Join(
                Environment.NewLine,
                differences.Select(d => $"Expected '{d.Expected}' but got '{d.Actual}'"));
        }
        else
        {
            score = EvaluationScore.Acceptable;
        }
        
        IEvaluation evaluation = evaluationFactory(
            this,
            score,
            reasoning: reasoning);
        return Task.FromResult(evaluation);
    }
}