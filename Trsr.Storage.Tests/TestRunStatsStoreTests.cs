using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Statistics;
using Trsr.Application.Statistics.TestRun;
using Trsr.Domain;
using Trsr.Domain.TestRun;
using Trsr.Domain.Usage;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class TestRunStatsStoreTests : BaseTest<Module>
{
    private static TestRunStats StatsFor(ITestRun run, int cases = 4, int passed = 3, DateTimeOffset? completed = null) =>
        new(TestRunId: run.Id,
            AgentId: run.Group.Suite.Agent.Id,
            EndpointId: run.Endpoint.Id,
            GroupId: run.Group.Id,
            SuiteId: run.Group.Suite.Id,
            TestCases: cases,
            Passed: passed,
            TotalDuration: TimeSpan.FromSeconds(2),
            Usage: new TokenUsage(100, 200),
            Cost: 0.05m,
            RunCompletedAt: completed ?? DateTimeOffset.UtcNow);

    [TestMethod]
    public async Task UpsertAsync_NewRow_PersistsAndIsReadable()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        var stats = StatsFor(run);
        await writer.UpsertAsync(stats, CancellationToken);

        var found = await reader.FindAsync(run.Id, CancellationToken);
        found.Should().NotBeNull();
        found.TestRunId.Should().Be(run.Id);
        found.TestCases.Should().Be(4);
        found.Passed.Should().Be(3);
        var usage = found.Usage;
        usage.Should().NotBeNull();
        usage.InputTokenCount.Should().Be(100);
        found.Cost.Should().Be(0.05m);
        found.TotalDuration.Should().Be(TimeSpan.FromSeconds(2));
    }

    [TestMethod]
    public async Task UpsertAsync_ExistingRow_UpdatesValuesInPlace()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        await writer.UpsertAsync(StatsFor(run, cases: 4, passed: 1), CancellationToken);
        await writer.UpsertAsync(StatsFor(run, cases: 6, passed: 5), CancellationToken);

        var found = await reader.FindAsync(run.Id, CancellationToken);
        found.Should().NotBeNull();
        found.TestCases.Should().Be(6);
        found.Passed.Should().Be(5);

        var all = await reader.QueryAsync(new TestRunStats.Filter(), CancellationToken);
        all.Should().ContainSingle(s => s.TestRunId == run.Id);
    }

    [TestMethod]
    public async Task FindAsync_Unknown_ReturnsNull()
    {
        var services = GetServices();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();

        var found = await reader.FindAsync(Guid.NewGuid(), CancellationToken);

        found.Should().BeNull();
    }

    [TestMethod]
    public async Task RemoveAsync_Existing_DeletesRow()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        await writer.UpsertAsync(StatsFor(run), CancellationToken);
        await writer.RemoveAsync(run.Id, CancellationToken);

        var found = await reader.FindAsync(run.Id, CancellationToken);
        found.Should().BeNull();
    }

    [TestMethod]
    public async Task RemoveAsync_Unknown_DoesNotThrow()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();

        await writer.Invoking(w => w.RemoveAsync(Guid.NewGuid(), CancellationToken))
            .Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task QueryAsync_FilterByAgent_ReturnsOnlyMatching()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        var runA = await gen.CreateAsync(CancellationToken);
        var runB = await gen.CreateAsync(CancellationToken);

        await writer.UpsertAsync(StatsFor(runA), CancellationToken);
        await writer.UpsertAsync(StatsFor(runB), CancellationToken);

        var agentA = runA.Group.Suite.Agent.Id;
        var agentB = Guid.NewGuid();
        if (agentB == agentA) agentB = Guid.NewGuid();
        await writer.UpsertAsync(StatsFor(runB) with { AgentId = agentB }, CancellationToken);

        var byAgentA = await reader.QueryAsync(
            new TestRunStats.Filter(AgentId: agentA), CancellationToken);

        byAgentA.Should().ContainSingle();
        byAgentA[0].TestRunId.Should().Be(runA.Id);
    }

    [TestMethod]
    public async Task QueryAsync_FilterByAgentIds_ReturnsAllInSet()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        var runA = await gen.CreateAsync(CancellationToken);
        var runB = await gen.CreateAsync(CancellationToken);

        await writer.UpsertAsync(StatsFor(runA), CancellationToken);
        await writer.UpsertAsync(StatsFor(runB), CancellationToken);

        var filtered = await reader.QueryAsync(
            new TestRunStats.Filter(AgentIds: [runA.Group.Suite.Agent.Id, runB.Group.Suite.Agent.Id]),
            CancellationToken);

        filtered.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task QueryAsync_FilterByDateRange_ExcludesOutsideWindow()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        var oldRun = await gen.CreateAsync(CancellationToken);
        var recentRun = await gen.CreateAsync(CancellationToken);

        var oldDate = DateTimeOffset.UtcNow.AddDays(-10);
        var recentDate = DateTimeOffset.UtcNow;
        await writer.UpsertAsync(StatsFor(oldRun, completed: oldDate), CancellationToken);
        await writer.UpsertAsync(StatsFor(recentRun, completed: recentDate), CancellationToken);

        var inWindow = await reader.QueryAsync(
            new TestRunStats.Filter(From: DateTimeOffset.UtcNow.AddDays(-1)),
            CancellationToken);

        inWindow.Should().ContainSingle(s => s.TestRunId == recentRun.Id);
    }

    [TestMethod]
    public async Task QueryAsync_FilterBySuiteAndEndpoint_ScopesResults()
    {
        var services = GetServices();
        var writer = services.GetRequiredService<IStatsWriter<TestRunStats>>();
        var reader = services.GetRequiredService<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);
        await writer.UpsertAsync(StatsFor(run), CancellationToken);

        var bySuite = await reader.QueryAsync(new TestRunStats.Filter(SuiteId: run.Group.Suite.Id), CancellationToken);
        var byEndpoint = await reader.QueryAsync(new TestRunStats.Filter(EndpointId: run.Endpoint.Id), CancellationToken);
        var byGroup = await reader.QueryAsync(new TestRunStats.Filter(GroupId: run.Group.Id), CancellationToken);
        var byUnknown = await reader.QueryAsync(new TestRunStats.Filter(SuiteId: Guid.NewGuid()), CancellationToken);

        bySuite.Should().ContainSingle();
        byEndpoint.Should().ContainSingle();
        byGroup.Should().ContainSingle();
        byUnknown.Should().BeEmpty();
    }
}
