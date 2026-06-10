using Proxytrace.Domain.Evaluation;

namespace Proxytrace.Domain.TestResult;

/// <summary>
/// Repository for <see cref="ITestResult"/> entities.
/// </summary>
public interface ITestResultRepository : IRepository<ITestResult>
{
    /// <summary>
    /// Returns the most recently created test result for the given test case, or null if none exist.
    /// </summary>
    Task<ITestResult?> GetLatestByTestCaseAsync(Guid testCaseId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the most recently created test result whose evaluations include the given evaluator, or null if none exist.
    /// </summary>
    Task<ITestResult?> GetLatestByEvaluatorAsync(Guid evaluatorId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the most recent test results whose evaluations include the given evaluator, ordered newest first,
    /// deduplicated by test case (keeping only the latest result per test case). When <paramref name="score"/>
    /// is supplied, only results whose evaluation by that evaluator scored exactly that value are returned.
    /// </summary>
    Task<IReadOnlyList<ITestResult>> GetRecentByEvaluatorAsync(
        Guid evaluatorId,
        int count,
        EvaluationScore? score = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns test results scored by the given evaluator whose test-case summary or this evaluator's
    /// reasoning matches <paramref name="query"/> (case-insensitive substring), newest first and
    /// deduplicated by test case (latest result per case). An empty query returns the most recent matches.
    /// </summary>
    Task<IReadOnlyList<ITestResult>> SearchByEvaluatorAsync(
        Guid evaluatorId,
        string query,
        int count,
        CancellationToken cancellationToken = default);
}
