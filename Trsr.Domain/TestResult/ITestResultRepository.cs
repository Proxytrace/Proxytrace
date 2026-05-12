namespace Trsr.Domain.TestResult;

/// <summary>
/// Repository for <see cref="ITestResult"/> entities.
/// </summary>
public interface ITestResultRepository : IRepository<ITestResult>
{
    /// <summary>
    /// Returns the most recently created test result for the given test case, or null if none exist.
    /// </summary>
    Task<ITestResult?> GetLatestByTestCaseAsync(Guid testCaseId, CancellationToken cancellationToken = default);
}
