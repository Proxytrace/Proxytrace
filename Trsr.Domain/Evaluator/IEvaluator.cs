using Trsr.Domain.Evaluation;
using Trsr.Domain.Search;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Evaluates whether an actual assistant response matches an expected output.
/// </summary>
public interface IEvaluator : IDomainEntity<IEvaluator>, ISearchable
{
    string Name { get; }
    
    /// <summary>The evaluation strategy used by this evaluator.</summary>
    EvaluatorKind Kind { get; }
    
    SearchKind ISearchable.SearchKind => SearchKind.Evaluator;
    
    /// <summary>
    /// Evaluates the actual output against the expected output, given the input conversation.
    /// </summary>
    Task<IEvaluation?> EvaluateAsync(
        ITestResult testResult,
        CancellationToken cancellationToken = default);
}
