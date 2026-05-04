using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Domain.TestRun.Internal;

internal record TestRun : DomainEntity<ITestRun>, ITestRun
{
    public ITestRunGroup Group { get; }
    public IModelEndpoint Endpoint { get; }
    public TestRunStatus Status { get; }
    public DateTimeOffset? CompletedAt { get; }
    public IReadOnlyList<ITestResult> TestResults { get; }

    public TestRun(
        ITestRunGroup group,
        IModelEndpoint endpoint,
        IRepository<ITestRun> repository) : base(repository)
    {
        Group = group;
        Endpoint = endpoint;
        Status = TestRunStatus.Pending;
        CompletedAt = null;
        TestResults = [];
    }

    public TestRun(
        ITestRunGroup group,
        IModelEndpoint endpoint,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IReadOnlyList<ITestResult> testResults,
        IDomainEntityData existing,
        IRepository<ITestRun> repository) : base(existing, repository)
    {
        Group = group;
        Endpoint = endpoint;
        Status = status;
        CompletedAt = completedAt;
        TestResults = testResults.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Endpoint.Validate(validationContext))
            yield return result;

        foreach (var result in TestResults.SelectMany(x => x.Validate(validationContext)))
            yield return result;

        if (Status == TestRunStatus.Completed)
        {
            yield return Validation.NotNull(CompletedAt);
            yield return Validation.HasCount(TestResults, Group.Suite.TestCases.Count);
        }
    }

    public async Task<ITestRun> SetTestResult(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestResult> updatedResults =
        [
            ..TestResults.Where(x => x.TestCase.Id != testResult.TestCase.Id),
            testResult
        ];

        bool isCompleted = updatedResults.Count == Group.Suite.TestCases.Count;
        DateTimeOffset? completedAt = isCompleted ? DateTimeOffset.UtcNow : null;
        TestRunStatus status = isCompleted ? TestRunStatus.Completed : TestRunStatus.Running;

        var updatedRun = new TestRun(
            Group,
            Endpoint,
            status,
            completedAt,
            updatedResults,
            this,
            repository);
        return await repository.UpdateAsync(updatedRun, cancellationToken);
    }

    public Task<ITestRun> SetRunning(CancellationToken cancellationToken = default)
        => SetState(TestRunStatus.Running, cancellationToken);

    public Task<ITestRun> SetCancelled(CancellationToken cancellationToken = default)
        => SetState(TestRunStatus.Cancelled, cancellationToken);

    private Task<ITestRun> SetState(TestRunStatus state, CancellationToken cancellationToken = default)
    {
        if (state == TestRunStatus.Running && Status != TestRunStatus.Pending)
        {
            throw new InvalidOperationException(
                $"Cannot set test run {Id} to running because it is not in pending status.");
        }

        DateTimeOffset? completedAt = null;
        if (IsTerminalState(state))
        {
            if (IsTerminalState(Status))
            {
                throw new InvalidOperationException(
                    $"Cannot change test run {Id} status from {Status} to {state} because it is already in a terminal state.");
            }

            if (CompletedAt.HasValue)
            {
                throw new InvalidOperationException(
                    $"Cannot set test run {Id} to {state} because it already has a completion time.");
            }

            completedAt = DateTimeOffset.UtcNow;
        }

        var updatedRun = new TestRun(
            Group,
            Endpoint,
            state,
            completedAt,
            TestResults,
            this,
            repository);
        return repository.UpdateAsync(updatedRun, cancellationToken);
    }

    private static bool IsTerminalState(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Cancelled or TestRunStatus.Failed;
}
