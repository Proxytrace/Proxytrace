using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Domain.TestRun.Internal;

internal record TestRun : DomainEntity<ITestRun>, ITestRun
{
    private readonly IStatisticsCalculator statisticsCalculator;
    public ITestRunGroup Group { get; }
    public IModelEndpoint Endpoint { get; }
    public TestRunStatus Status { get; private init; }
    public DateTimeOffset? CompletedAt { get; private init; }
    public IReadOnlyList<ITestResult> TestResults { get; private init; }
    public TestRunStatistics Statistics { get; private init; }

    public TestRun(
        ITestRunGroup group,
        IModelEndpoint endpoint,
        IRepository<ITestRun> repository,
        IStatisticsCalculator statisticsCalculator) : base(repository)
    {
        this.statisticsCalculator = statisticsCalculator;
        Group = group;
        Endpoint = endpoint;
        Status = TestRunStatus.Pending;
        CompletedAt = null;
        TestResults = [];
        Statistics = TestRunStatistics.Empty;
    }

    public TestRun(
        ITestRunGroup group,
        IModelEndpoint endpoint,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IReadOnlyList<ITestResult> testResults,
        TestRunStatistics statistics,
        IDomainEntityData existing,
        IRepository<ITestRun> repository,
        IStatisticsCalculator statisticsCalculator) : base(existing, repository)
    {
        this.statisticsCalculator = statisticsCalculator;
        Group = group;
        Endpoint = endpoint;
        Status = status;
        CompletedAt = completedAt;
        TestResults = testResults.ToArray();
        Statistics = statistics;
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
            foreach (var __r in Validation.NotNull(CompletedAt).AsEnumerable()) yield return __r;
        }
    }

    public Task<ITestRun> SetTestResult(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestResult> updatedResults =
        [
            ..TestResults.Where(x => x.TestCase.Id != testResult.TestCase.Id),
            testResult
        ];

        bool isCompleted = updatedResults.Count == Group.Suite.TestCases.Count;
        DateTimeOffset? completedAt = isCompleted ? DateTimeOffset.UtcNow : null;
        TestRunStatus status = isCompleted ? TestRunStatus.Completed : TestRunStatus.Running;
        
        TestRunStatistics statistics = statisticsCalculator.CalculateStatistics(this);

        return ApplyAsync(this with
        {
            Status = status,
            CompletedAt = completedAt,
            TestResults = updatedResults,
            Statistics = statistics,
        }, cancellationToken);
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

        return ApplyAsync(this with { Status = state, CompletedAt = completedAt }, cancellationToken);
    }

    private static bool IsTerminalState(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Cancelled or TestRunStatus.Failed;
}
