using System.ComponentModel.DataAnnotations;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.TestRunGroup.Internal;

internal record TestRunGroup : DomainEntity<ITestRunGroup>, ITestRunGroup
{
    private readonly ITestRunRepository testRuns;

    public ITestSuite Suite { get; }
    public TestRunStatus Status { get; private init; }
    public DateTimeOffset? CompletedAt { get; private init; }
    public bool IsSystemRun { get; }

    public TestRunGroup(
        ITestSuite suite,
        bool isSystemRun,
        IRepository<ITestRunGroup> repository,
        ITestRunRepository testRuns) : base(repository)
    {
        this.testRuns = testRuns;
        Suite = suite;
        Status = TestRunStatus.Pending;
        CompletedAt = null;
        IsSystemRun = isSystemRun;
    }

    public TestRunGroup(
        ITestSuite suite,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        bool isSystemRun,
        IDomainEntityData existing,
        IRepository<ITestRunGroup> repository,
        ITestRunRepository testRuns) : base(existing, repository)
    {
        this.testRuns = testRuns;
        Suite = suite;
        Status = status;
        CompletedAt = completedAt;
        IsSystemRun = isSystemRun;
    }

    public Task<IReadOnlyList<ITestRun>> GetTestRuns(CancellationToken cancellationToken = default)
        => testRuns.GetByGroupAsync(Id, cancellationToken);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Suite.Validate(validationContext))
            yield return result;
    }

    public Task<ITestRunGroup> SetRunning(CancellationToken cancellationToken = default)
        => SetState(TestRunStatus.Running, cancellationToken);

    public Task<ITestRunGroup> SetCompleted(CancellationToken cancellationToken = default)
        => SetState(TestRunStatus.Completed, cancellationToken);

    public Task<ITestRunGroup> SetFailed(CancellationToken cancellationToken = default)
        => SetState(TestRunStatus.Failed, cancellationToken);

    public Task<ITestRunGroup> SetCancelled(CancellationToken cancellationToken = default)
        => SetState(TestRunStatus.Cancelled, cancellationToken);

    private Task<ITestRunGroup> SetState(TestRunStatus state, CancellationToken cancellationToken)
    {
        if (IsTerminal(Status))
        {
            throw new InvalidOperationException(
                $"Cannot change test run group {Id} status from {Status} to {state} because it is already in a terminal state.");
        }

        DateTimeOffset? completedAt = IsTerminal(state) ? DateTimeOffset.UtcNow : null;
        return ApplyAsync(this with { Status = state, CompletedAt = completedAt }, cancellationToken);
    }

    private static bool IsTerminal(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled;
}
