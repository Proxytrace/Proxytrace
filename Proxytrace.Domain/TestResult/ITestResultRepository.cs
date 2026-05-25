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
    /// deduplicated by test case (keeping only the latest result per test case).
    /// </summary>
    Task<IReadOnlyList<ITestResult>> GetRecentByEvaluatorAsync(Guid evaluatorId, int count, CancellationToken cancellationToken = default);
}
