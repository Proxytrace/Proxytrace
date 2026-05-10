using Microsoft.Extensions.Logging;
using Trsr.Application.Statistics.Internal.Projection;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.TestRun;
using Trsr.Domain.Usage;

namespace Trsr.Application.Statistics.TestRun.Internal;

internal sealed class TestRunStatsProjector : AbstractStatsProjector<ITestRun, TestRunStats>
{
    public TestRunStatsProjector(IStatsWriter<TestRunStats> writer, IRepository<ITestRun> repository) :
        base(writer, repository)
    {
    }

    protected override Task<TestRunStats> ComputeStatsAsync(ITestRun run, CancellationToken cancellationToken)
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

        var stats = new TestRunStats(
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
        return Task.FromResult(stats);
    }
}
