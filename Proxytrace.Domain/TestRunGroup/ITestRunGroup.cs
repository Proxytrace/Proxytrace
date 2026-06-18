using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.TestRunGroup;

/// <summary>
/// Groups test runs executing the same suite against multiple endpoints for model comparison.
/// </summary>
public interface ITestRunGroup : IDomainEntity<ITestRunGroup>
{
    /// <summary>The test suite executed by all runs in this group.</summary>
    ITestSuite Suite { get; }

    /// <summary>The aggregate execution status across all child runs.</summary>
    TestRunStatus Status { get; }

    /// <summary>When the last child run finished, or null if still running.</summary>
    DateTimeOffset? CompletedAt { get; }

    /// <summary>
    /// True for ephemeral A/B runs spawned internally to validate optimization theories.
    /// These are hidden from the user-facing test-run list by default.
    /// </summary>
    bool IsSystemRun { get; }

    /// <summary>The schedule that triggered this group, or null for a manual/system run.</summary>
    Guid? ScheduleId { get; }

    /// <summary>Factory delegate for creating a new test run group.</summary>
    public delegate ITestRunGroup CreateNew(ITestSuite suite, bool isSystemRun, Guid? scheduleId);

    /// <summary>Factory delegate for reconstituting an existing test run group from persistence.</summary>
    public delegate ITestRunGroup CreateExisting(
        ITestSuite suite,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        bool isSystemRun,
        Guid? scheduleId,
        IDomainEntityData existing);

    Task<ITestRunGroup> SetRunning(CancellationToken cancellationToken = default);
    Task<ITestRunGroup> SetCompleted(CancellationToken cancellationToken = default);
    Task<ITestRunGroup> SetFailed(CancellationToken cancellationToken = default);
    Task<ITestRunGroup> SetCancelled(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ITestRun>> GetTestRuns(CancellationToken cancellationToken = default);
}
