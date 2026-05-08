using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Project;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Storage.Internal.Entities.AgentCall;
using Trsr.Storage.Internal.Entities.Inference;
using Trsr.Storage.Internal.Entities.OptimizationProposal;
using Trsr.Storage.Internal.Entities.TestRun;
using Trsr.Storage.Internal.Entities.TestRunGroup;
using Trsr.Storage.Internal.Entities.TestSuite;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class StatisticsQueryServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAgentTimeSeries_BucketsByDay_OverGivenRange()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services);
        var now = DateTimeOffset.UtcNow;
        var anchor = new DateTimeOffset(now.Year, now.Month, now.Day, 12, 0, 0, TimeSpan.Zero);

        await InsertAgentCallAsync(services, agent.Id, endpoint.Id, anchor.AddDays(-2), inputTokens: 100, outputTokens: 50);
        await InsertAgentCallAsync(services, agent.Id, endpoint.Id, anchor.AddDays(-2), inputTokens: 200, outputTokens: 100);
        await InsertAgentCallAsync(services, agent.Id, endpoint.Id, anchor.AddDays(-1), inputTokens: 300, outputTokens: 150);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var from = anchor.AddDays(-3);
        var to = anchor;
        var series = await stats.GetAgentTimeSeriesAsync(agent.Id, from, to, StatisticsBucket.Daily, CancellationToken);

        var nonEmpty = series.Where(p => p.TraceCount > 0).ToList();
        nonEmpty.Should().HaveCount(2);
        nonEmpty.Sum(p => p.TraceCount).Should().Be(3);
        nonEmpty.Sum(p => p.InputTokens).Should().Be(600);
        nonEmpty.Sum(p => p.OutputTokens).Should().Be(300);
    }

    [TestMethod]
    public async Task GetAgentTimeSeries_FillsEmptyBucketsWithZeros()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services);
        var now = DateTimeOffset.UtcNow;
        var anchor = new DateTimeOffset(now.Year, now.Month, now.Day, 12, 0, 0, TimeSpan.Zero);

        await InsertAgentCallAsync(services, agent.Id, endpoint.Id, anchor.AddDays(-1), inputTokens: 10, outputTokens: 5);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var series = await stats.GetAgentTimeSeriesAsync(
            agent.Id, anchor.AddDays(-3), anchor, StatisticsBucket.Daily, CancellationToken);

        series.Should().HaveCountGreaterThanOrEqualTo(4);
        series.Count(p => p.TraceCount > 0).Should().Be(1);
        series.Count(p => p.TraceCount == 0).Should().BeGreaterThan(0);
    }

    [TestMethod]
    public async Task GetAgentTimeSeries_FiltersOtherAgents()
    {
        var services = GetServices();
        var (agentA, endpoint) = await CreateAgentAndEndpointAsync(services);
        var (agentB, _) = await CreateAgentAndEndpointAsync(services);
        var anchor = DateTimeOffset.UtcNow.AddMinutes(-10);

        await InsertAgentCallAsync(services, agentA.Id, endpoint.Id, anchor, inputTokens: 10, outputTokens: 5);
        await InsertAgentCallAsync(services, agentB.Id, endpoint.Id, anchor, inputTokens: 999, outputTokens: 999);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var series = await stats.GetAgentTimeSeriesAsync(
            agentA.Id, anchor.AddHours(-1), anchor.AddHours(1), StatisticsBucket.Hourly, CancellationToken);

        series.Sum(p => p.TraceCount).Should().Be(1);
        series.Sum(p => p.InputTokens).Should().Be(10);
        series.Sum(p => p.OutputTokens).Should().Be(5);
    }

    [TestMethod]
    public async Task GetAgentTimeSeries_ComputesCostFromEndpoint()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services, inputCostPerMillion: 10m, outputCostPerMillion: 30m);
        var anchor = DateTimeOffset.UtcNow.AddMinutes(-10);

        await InsertAgentCallAsync(services, agent.Id, endpoint.Id, anchor, inputTokens: 1_000_000, outputTokens: 500_000);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var series = await stats.GetAgentTimeSeriesAsync(
            agent.Id, anchor.AddHours(-1), anchor.AddHours(1), StatisticsBucket.Hourly, CancellationToken);

        var totalCost = series.Sum(p => p.CostEur);
        totalCost.Should().Be(25m);
    }

    [TestMethod]
    public async Task GetAgentPassRateTrend_AggregatesByDay()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services);
        var anchor = DateTimeOffset.UtcNow.AddMinutes(-10);

        var suiteId = await InsertSuiteAsync(services, agent.Id);
        var groupId = await InsertGroupAsync(services, suiteId);
        await InsertCompletedRunAsync(services, groupId, endpoint.Id, completedAt: anchor.AddDays(-2), passed: 3, testCases: 5);
        await InsertCompletedRunAsync(services, groupId, endpoint.Id, completedAt: anchor.AddDays(-1), passed: 4, testCases: 5);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var trend = await stats.GetAgentPassRateTrendAsync(
            agent.Id, anchor.AddDays(-3), anchor, StatisticsBucket.Daily, CancellationToken);

        trend.Sum(p => p.Passed).Should().Be(7);
        trend.Sum(p => p.TestCases).Should().Be(10);
        trend.Count(p => p.TestCases > 0).Should().Be(2);
    }

    [TestMethod]
    public async Task GetAgentLatestSuitePassRates_ReturnsLatestRunPerSuite()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services);
        var anchor = DateTimeOffset.UtcNow.AddMinutes(-10);

        var suiteAId = await InsertSuiteAsync(services, agent.Id, name: "Suite A");
        var suiteBId = await InsertSuiteAsync(services, agent.Id, name: "Suite B");
        var groupAId = await InsertGroupAsync(services, suiteAId);
        var groupBId = await InsertGroupAsync(services, suiteBId);

        await InsertCompletedRunAsync(services, groupAId, endpoint.Id, completedAt: anchor.AddDays(-2), passed: 1, testCases: 5);
        await InsertCompletedRunAsync(services, groupAId, endpoint.Id, completedAt: anchor.AddDays(-1), passed: 4, testCases: 5);
        await InsertCompletedRunAsync(services, groupBId, endpoint.Id, completedAt: anchor.AddDays(-3), passed: 2, testCases: 4);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var rates = await stats.GetAgentLatestSuitePassRatesAsync(agent.Id, CancellationToken);

        rates.Should().HaveCount(2);
        var a = rates.Single(r => r.SuiteId == suiteAId);
        a.Passed.Should().Be(4);
        a.TestCases.Should().Be(5);
        var b = rates.Single(r => r.SuiteId == suiteBId);
        b.Passed.Should().Be(2);
        b.TestCases.Should().Be(4);
    }

    [TestMethod]
    public async Task GetAgentEntityCounts_CountsSuitesTestCasesProposals()
    {
        var services = GetServices();
        var (agent, _) = await CreateAgentAndEndpointAsync(services);

        await InsertSuiteAsync(services, agent.Id, testCaseCount: 3);
        await InsertSuiteAsync(services, agent.Id, testCaseCount: 4);
        await InsertProposalAsync(services, agent.Id, ProposalStatus.Draft);
        await InsertProposalAsync(services, agent.Id, ProposalStatus.Draft);
        await InsertProposalAsync(services, agent.Id, ProposalStatus.Accepted);
        await InsertProposalAsync(services, agent.Id, ProposalStatus.Rejected);
        await InsertProposalAsync(services, agent.Id, ProposalStatus.Accepted);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var counts = await stats.GetAgentEntityCountsAsync(agent.Id, CancellationToken);

        counts.SuiteCount.Should().Be(2);
        counts.TestCaseCount.Should().Be(7);
        counts.OpenProposalCount.Should().Be(2);
        counts.TotalProposalCount.Should().Be(5);
    }

    [TestMethod]
    public async Task GetAgentOverview_AggregatesAllSections()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services, inputCostPerMillion: 10m, outputCostPerMillion: 20m);
        var anchor = DateTimeOffset.UtcNow.AddMinutes(-10);

        await InsertAgentCallAsync(services, agent.Id, endpoint.Id, anchor, inputTokens: 1_000_000, outputTokens: 1_000_000, latencyMs: 200);
        var suiteId = await InsertSuiteAsync(services, agent.Id, testCaseCount: 5);
        var groupId = await InsertGroupAsync(services, suiteId);
        await InsertCompletedRunAsync(services, groupId, endpoint.Id, completedAt: anchor.AddDays(-1), passed: 4, testCases: 5);
        await InsertProposalAsync(services, agent.Id, ProposalStatus.Draft);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var overview = await stats.GetAgentOverviewAsync(
            agent.Id, anchor.AddDays(-2), anchor.AddHours(1), StatisticsBucket.Daily, CancellationToken);

        overview.Summary.TotalTraces.Should().Be(1);
        overview.Summary.TotalInputTokens.Should().Be(1_000_000);
        overview.Summary.TotalOutputTokens.Should().Be(1_000_000);
        overview.Summary.TotalCostEur.Should().Be(30m);
        overview.Summary.AvgLatencyMs.Should().Be(200);
        overview.Counts.SuiteCount.Should().Be(1);
        overview.Counts.TestCaseCount.Should().Be(5);
        overview.Counts.OpenProposalCount.Should().Be(1);
        overview.Counts.TotalProposalCount.Should().Be(1);
        overview.SuitePassRates.Should().HaveCount(1);
        overview.SuitePassRates.Single().Passed.Should().Be(4);
        overview.PassRateTrend.Sum(p => p.TestCases).Should().Be(5);
        overview.PassRateTrend.Sum(p => p.Passed).Should().Be(4);
    }

    [TestMethod]
    public async Task PassRates_ReturnSuiteIdNotAgentId()
    {
        var services = GetServices();
        var (agent, endpoint) = await CreateAgentAndEndpointAsync(services);
        var suiteId = await InsertSuiteAsync(services, agent.Id);
        var groupId = await InsertGroupAsync(services, suiteId);
        await InsertCompletedRunAsync(services, groupId, endpoint.Id, completedAt: DateTimeOffset.UtcNow.AddMinutes(-5), passed: 1, testCases: 1);

        var stats = services.GetRequiredService<IStatisticsQueryService>();
        var passRates = await stats.GetPassRatesAsync(new StatisticsFilter(AgentId: agent.Id), CancellationToken);

        passRates.Should().HaveCount(1);
        passRates[0].SuiteId.Should().Be(suiteId);
        passRates[0].SuiteId.Should().NotBe(agent.Id);
    }

    private async Task<(IAgent Agent, IModelEndpoint Endpoint)> CreateAgentAndEndpointAsync(
        IServiceProvider services,
        decimal? inputCostPerMillion = null,
        decimal? outputCostPerMillion = null)
    {
        var endpointGenerator = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();

        var endpoint = await endpointGenerator.CreateAsync(CancellationToken);
        if (inputCostPerMillion.HasValue || outputCostPerMillion.HasValue)
        {
            var endpointRepo = services.GetRequiredService<IRepository<IModelEndpoint>>();
            var createExisting = services.GetRequiredService<IModelEndpoint.CreateExisting>();
            var updated = createExisting(endpoint.Model, endpoint.Provider, inputCostPerMillion, outputCostPerMillion, endpoint);
            endpoint = await endpointRepo.UpdateAsync(updated, CancellationToken);
        }
        var agent = await agentGenerator.CreateAsync(CancellationToken);
        return (agent, endpoint);
    }

    private async Task InsertAgentCallAsync(
        IServiceProvider services,
        Guid agentId,
        Guid endpointId,
        DateTimeOffset createdAt,
        ulong inputTokens,
        ulong outputTokens,
        double latencyMs = 100d)
    {
        var ctx = services.GetRequiredService<StorageDbContext>();
        ctx.Set<AgentCallEntity>().Add(new AgentCallEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = createdAt,
            UpdatedAt = createdAt,
            AgentId = agentId,
            EndpointId = endpointId,
            Request = Conversation.Create(),
            Response = null,
            InputTokens = inputTokens,
            OutputTokens = outputTokens,
            LatencyMs = latencyMs,
            HttpStatus = 200,
            FinishReason = "stop",
            ErrorMessage = null,
            ModelParameters = ModelParametersData.Empty,
            ConversationId = null,
        });
        await ctx.SaveChangesAsync(CancellationToken);
    }

    private async Task<Guid> InsertSuiteAsync(
        IServiceProvider services,
        Guid agentId,
        string name = "Suite",
        int testCaseCount = 0)
    {
        var ctx = services.GetRequiredService<StorageDbContext>();
        var suiteId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow.AddMinutes(-1);
        var testCaseIds = Enumerable.Range(0, testCaseCount).Select(_ => Guid.NewGuid()).ToArray();
        ctx.Set<TestSuiteEntity>().Add(new TestSuiteEntity
        {
            Id = suiteId,
            CreatedAt = now,
            UpdatedAt = now,
            Name = name,
            Agent = agentId,
            TestCases = testCaseIds,
            TestSuiteEvaluators = new List<TestSuiteEvaluatorEntity>(),
        });
        await ctx.SaveChangesAsync(CancellationToken);
        return suiteId;
    }

    private async Task<Guid> InsertGroupAsync(
        IServiceProvider services,
        Guid suiteId)
    {
        var ctx = services.GetRequiredService<StorageDbContext>();
        var groupId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow.AddMinutes(-1);
        ctx.Set<TestRunGroupEntity>().Add(new TestRunGroupEntity
        {
            Id = groupId,
            CreatedAt = now,
            UpdatedAt = now,
            Suite = suiteId,
            Status = TestRunStatus.Completed,
            CompletedAt = now,
        });
        await ctx.SaveChangesAsync(CancellationToken);
        return groupId;
    }

    private async Task InsertCompletedRunAsync(
        IServiceProvider services,
        Guid groupId,
        Guid endpointId,
        DateTimeOffset completedAt,
        int passed,
        int testCases)
    {
        var ctx = services.GetRequiredService<StorageDbContext>();
        ctx.Set<TestRunEntity>().Add(new TestRunEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = completedAt,
            UpdatedAt = completedAt,
            Group = groupId,
            Endpoint = endpointId,
            Status = TestRunStatus.Completed,
            CompletedAt = completedAt,
            TestResults = Array.Empty<Guid>(),
            StatTestCases = testCases,
            StatPassed = passed,
            StatInputTokens = 0,
            StatOutputTokens = 0,
            StatTotalDurationMs = 0,
            StatCost = 0,
        });
        await ctx.SaveChangesAsync(CancellationToken);
    }

    private async Task InsertProposalAsync(
        IServiceProvider services,
        Guid agentId,
        ProposalStatus status)
    {
        var ctx = services.GetRequiredService<StorageDbContext>();
        var now = DateTimeOffset.UtcNow.AddMinutes(-1);
        ctx.Set<OptimizationProposalEntity>().Add(new OptimizationProposalEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now,
            Agent = agentId,
            Kind = ProposalKind.SystemPrompt,
            Status = status,
            Priority = Priority.Medium,
            Rationale = "test",
            Details = "{}",
            EvidenceTestRunIds = "[]",
        });
        await ctx.SaveChangesAsync(CancellationToken);
    }

    [TestMethod]
    public async Task GetAgentBreakdown_GroupsCallsByAgent()
    {
        IServiceProvider services = GetServices();
        var statistics = services.GetRequiredService<IStatisticsQueryService>();
        var agentGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var callGenerator = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var callFactory = services.GetRequiredService<IAgentCall.CreateNew>();
        var callRepository = services.GetRequiredService<IRepository<IAgentCall>>();

        var agentA = await agentGenerator.CreateAsync(CancellationToken);
        var agentB = await agentGenerator.CreateAsync(CancellationToken);

        for (int i = 0; i < 3; i++)
        {
            var template = await callGenerator.GenerateAsync(CancellationToken);
            var call = callFactory(
                agent: agentA,
                endpoint: template.Endpoint,
                request: template.Request,
                response: template.Response,
                httpStatus: template.HttpStatus,
                finishReason: template.FinishReason,
                errorMessage: template.ErrorMessage,
                conversationId: template.ConversationId);
            await callRepository.AddAsync(call, CancellationToken);
        }

        var bTemplate = await callGenerator.GenerateAsync(CancellationToken);
        var bCall = callFactory(
            agent: agentB,
            endpoint: bTemplate.Endpoint,
            request: bTemplate.Request,
            response: bTemplate.Response,
            httpStatus: bTemplate.HttpStatus,
            finishReason: bTemplate.FinishReason,
            errorMessage: bTemplate.ErrorMessage,
            conversationId: bTemplate.ConversationId);
        await callRepository.AddAsync(bCall, CancellationToken);

        var result = await statistics.GetAgentBreakdownAsync(new StatisticsFilter(), CancellationToken);

        result.Should().HaveCount(2);
        result.Single(r => r.AgentId == agentA.Id).CallCount.Should().Be(3);
        result.Single(r => r.AgentId == agentB.Id).CallCount.Should().Be(1);
        result.Should().BeInDescendingOrder(r => r.CallCount);
    }

    [TestMethod]
    public async Task GetAgentBreakdown_EmptyDatabase_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var statistics = services.GetRequiredService<IStatisticsQueryService>();

        var result = await statistics.GetAgentBreakdownAsync(new StatisticsFilter(), CancellationToken);

        result.Should().BeEmpty();
    }
}
