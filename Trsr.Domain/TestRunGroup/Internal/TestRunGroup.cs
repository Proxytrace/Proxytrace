using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Domain.TestRunGroup.Internal;

internal record TestRunGroup : DomainEntity<ITestRunGroup>, ITestRunGroup
{
    public ITestSuite Suite { get; }
    public TestRunStatus Status { get; }
    public DateTimeOffset? CompletedAt { get; }

    public TestRunGroup(
        ITestSuite suite,
        IRepository<ITestRunGroup> repository) : base(repository)
    {
        Suite = suite;
        Status = TestRunStatus.Pending;
        CompletedAt = null;
    }

    public TestRunGroup(
        ITestSuite suite,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IDomainEntityData existing,
        IRepository<ITestRunGroup> repository) : base(existing, repository)
    {
        Suite = suite;
        Status = status;
        CompletedAt = completedAt;
    }

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
        var updated = new TestRunGroup(Suite, state, completedAt, this, repository);
        return repository.UpdateAsync(updated, cancellationToken);
    }

    private static bool IsTerminal(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled;
}
