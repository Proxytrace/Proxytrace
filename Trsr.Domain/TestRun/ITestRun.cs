using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Domain.TestRun;

/// <summary>
/// Represents an execution of a test suite against a single endpoint, belonging to a test run group.
/// </summary>
public interface ITestRun : IDomainEntity<ITestRun>
{
    /// <summary>The group this run belongs to, which owns the suite and name.</summary>
    ITestRunGroup Group { get; }

    /// <summary>The endpoint to test against.</summary>
    IModelEndpoint Endpoint { get; }

    /// <summary>The current execution status of this run.</summary>
    TestRunStatus Status { get; }

    /// <summary>The time at which this run finished, or null if still running.</summary>
    DateTimeOffset? CompletedAt { get; }

    /// <summary>The ordered list of results for each test case executed during this run.</summary>
    IReadOnlyList<ITestResult> TestResults { get; }

    /// <summary>Factory delegate for creating a new test run.</summary>
    public delegate ITestRun CreateNew(
        ITestRunGroup group,
        IModelEndpoint endpoint);

    /// <summary>Factory delegate for reconstituting an existing test run from persistence.</summary>
    public delegate ITestRun CreateExisting(
        ITestRunGroup group,
        IModelEndpoint endpoint,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IReadOnlyList<ITestResult> testResults,
        IDomainEntityData existing);

    /// <summary>
    /// Adds the <paramref name="testResult"/> to the <see cref="TestResults"/>.
    /// If all testresults are set, the test run is completed.
    /// </summary>
    Task<ITestRun> SetTestResult(
        ITestResult testResult,
        CancellationToken cancellationToken = default);

    Task<ITestRun> SetRunning(CancellationToken cancellationToken = default);

    Task<ITestRun> SetCancelled(CancellationToken cancellationToken = default);
}
