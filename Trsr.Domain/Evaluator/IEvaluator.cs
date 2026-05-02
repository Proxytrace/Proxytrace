using Trsr.Domain.Evaluation;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Evaluates whether an actual assistant response matches an expected output.
/// </summary>
public interface IEvaluator : IDomainEntity
{
    /// <summary>The evaluation strategy used by this evaluator.</summary>
    EvaluatorKind Kind { get; }

    /// <summary>
    /// Evaluates the actual output against the expected output, given the input conversation.
    /// </summary>
    Task<IEvaluation> EvaluateAsync(
        ITestResult testResult,
        CancellationToken cancellationToken = default);
}
