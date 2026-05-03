using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestSuite;

namespace Trsr.Domain.TestRun.Internal;

internal record TestRun : DomainEntity, ITestRun
{
    private readonly Lazy<IRepository<ITestRun>> repository;
    
    public ITestSuite Suite { get; }
    public IModelEndpoint Endpoint { get; }
    public TestRunStatus Status { get; }
    public DateTimeOffset? CompletedAt { get; }
    public IReadOnlyList<ITestResult> TestResults { get; }

    public TestRun(
        ITestSuite suite,
        IModelEndpoint endpoint,
        Lazy<IRepository<ITestRun>> repository)
    {
        this.repository = repository;
        Suite = suite;
        Endpoint = endpoint;
        Status = TestRunStatus.Pending;
        CompletedAt = null;
        TestResults = [];
    }

    public TestRun(
        ITestSuite suite,
        IModelEndpoint endpoint,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IReadOnlyList<ITestResult> testResults,
        IDomainEntityData existing,
        Lazy<IRepository<ITestRun>> repository) : base(existing)
    {
        this.repository = repository;
        Suite = suite;
        Endpoint = endpoint;
        Status = status;
        CompletedAt = completedAt;
        TestResults = testResults.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Endpoint.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in TestResults.SelectMany(x => x.Validate(validationContext)))
        {
            yield return result;
        }

        if (Status == TestRunStatus.Completed)
        {
            yield return Validation.NotNull(CompletedAt);
            yield return Validation.HasCount(TestResults, Suite.TestCases.Count);
        }
    }

    public async Task<ITestRun> SetTestResult(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestResult> updatedResults =
        [
            ..TestResults.Where(x => x.TestCase.Id != testResult.TestCase.Id),
            testResult
        ];

        bool isCompleted = updatedResults.Count == Suite.TestCases.Count;
        DateTimeOffset? completedAt = isCompleted ? DateTimeOffset.UtcNow : null;
        TestRunStatus status = isCompleted ? TestRunStatus.Completed : TestRunStatus.Running;

        var updatedRun = new TestRun(
            Suite,
            Endpoint,
            status,
            completedAt,
            updatedResults,
            this,
            repository);
        return await repository.Value.UpdateAsync(updatedRun, cancellationToken);
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
            Suite,
            Endpoint,
            state,
            completedAt,
            TestResults,
            this,
            repository);
        return repository.Value.UpdateAsync(updatedRun, cancellationToken);
    }

    private bool IsTerminalState(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Cancelled or TestRunStatus.Failed;
}