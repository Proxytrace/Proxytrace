using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.TestRun;
using Trsr.Domain.Usage;

namespace Trsr.Application.Statistics.Internal;

internal class TestRunStatsProjector : IStatsProjector
{
    private readonly IRepository<ITestRun> testRuns;
    private readonly ITestRunStatsStore store;
    private readonly ILogger<TestRunStatsProjector> logger;

    public TestRunStatsProjector(
        IRepository<ITestRun> testRuns,
        ITestRunStatsStore store,
        ILogger<TestRunStatsProjector> logger)
    {
        this.testRuns = testRuns;
        this.store = store;
        this.logger = logger;
    }

    public Type EntityType => typeof(ITestRun);

    public async Task ProjectAsync(Guid entityId, EntityChangeType change, CancellationToken cancellationToken)
    {
        if (change == EntityChangeType.Removed)
        {
            await store.DeleteAsync(entityId, cancellationToken);
            return;
        }

        ITestRun? run = await testRuns.FindAsync(entityId, cancellationToken);
        if (run is null)
        {
            await store.DeleteAsync(entityId, cancellationToken);
            return;
        }

        TestRunStats stats = Compute(run);
        await store.UpsertAsync(stats, cancellationToken);
    }

    private static TestRunStats Compute(ITestRun run)
    {
        int testCases = run.Group.Suite.TestCases.Count;
        int passed = run.TestResults.Count(r => r.Passed);

        TokenUsage? usage = run.TestResults
            .Select(r => r.Usage)
            .Aggregate<TokenUsage?, TokenUsage?>(null, (acc, next) => acc is null ? next : acc + next);

        TimeSpan? duration = run.TestResults.Count > 0
            ? TimeSpan.FromTicks(run.TestResults.Sum(r => r.Latency.Ticks))
            : null;

        decimal? cost = usage is not null
            ? run.Endpoint.CalculateCost(usage)
            : null;

        return new TestRunStats(
            TestRunId: run.Id,
            AgentId: run.Group.Suite.Agent.Id,
            EndpointId: run.Endpoint.Id,
            GroupId: run.Group.Id,
            SuiteId: run.Group.Suite.Id,
            TestCases: testCases,
            Passed: passed,
            TotalDuration: duration,
            Usage: usage,
            Cost: cost,
            RunCompletedAt: run.CompletedAt ?? run.UpdatedAt);
    }
}
