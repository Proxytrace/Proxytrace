using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Statistics;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Usage;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class AgentCallStatsQueriesTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetSummary_EmptyDb_ReturnsZeros()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var summary = await reader.GetSummaryAsync(new StatisticsFilter(), CancellationToken);

        summary.TotalCalls.Should().Be(0);
        summary.TotalInputTokens.Should().Be(0);
        summary.TotalOutputTokens.Should().Be(0);
        summary.AvgLatencyMs.Should().Be(0);
    }

    [TestMethod]
    public async Task GetSummary_AfterSeedingCalls_AggregatesTotals()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);

        var summary = await reader.GetSummaryAsync(new StatisticsFilter(), CancellationToken);

        summary.TotalCalls.Should().Be(2);
    }

    [TestMethod]
    public async Task GetTokenUsage_AggregatesPerEndpointPerDate()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var rows = await reader.GetTokenUsageAsync(new StatisticsFilter(), StatisticsBucket.Daily, CancellationToken);

        rows.Should().NotBeEmpty();
    }

    [TestMethod]
    public async Task GetEarliestCall_EmptyDb_ReturnsNull()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var earliest = await reader.GetEarliestCallAsync(new StatisticsFilter(), CancellationToken);

        earliest.Should().BeNull();
    }

    [TestMethod]
    public async Task GetEarliestCall_AfterSeedingCalls_ReturnsOldestTimestamp()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var first = await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);

        var earliest = await reader.GetEarliestCallAsync(new StatisticsFilter(), CancellationToken);

        earliest.Should().NotBeNull();
        earliest.Should().BeOnOrBefore(first.CreatedAt);
    }

    [TestMethod]
    public async Task GetErrorRates_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetErrorRatesAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetAgentBreakdown_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetAgentBreakdownAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetCostEstimate_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetCostEstimateAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetCostEstimate_SeededCalls_AgreesWithCalculateCost()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        // An endpoint with known per-1M-token prices (input <= output, cached <= input).
        var endpointSeedGen = services.GetRequiredService<IDomainObjectGenerator<IModelEndpoint>>();
        var seed = await endpointSeedGen.CreateAsync(CancellationToken);
        var createEndpoint = services.GetRequiredService<IModelEndpoint.CreateNew>();
        var endpointRepo = services.GetRequiredService<IRepository<IModelEndpoint>>();
        IModelEndpoint endpoint = await endpointRepo.AddAsync(
            createEndpoint(seed.Model, seed.Provider, inputTokenCost: 2.5m, outputTokenCost: 10m, cachedInputTokenCost: 1m),
            CancellationToken);

        // Two calls on that endpoint with known token counts.
        var agentGen = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var agent = await agentGen.CreateAsync(CancellationToken);
        var conversationGen = services.GetRequiredService<IDomainObjectGenerator<Conversation>>();
        var completionGen = services.GetRequiredService<IDomainObjectGenerator<ICompletion>>();
        var sampleResponse = (await completionGen.CreateAsync(CancellationToken)).Response;
        var createCompletion = services.GetRequiredService<ICompletion.Create>();
        var createCall = services.GetRequiredService<IAgentCall.CreateNew>();
        var callRepo = services.GetRequiredService<IRepository<IAgentCall>>();

        var usages = new[] { new TokenUsage(1000, 500, 200), new TokenUsage(3000, 1500, 0) };
        foreach (var usage in usages)
        {
            var response = createCompletion(sampleResponse, usage, TimeSpan.FromMilliseconds(10));
            var request = await conversationGen.CreateAsync(CancellationToken);
            var call = createCall(agent, agent.CurrentVersion, endpoint, request, response);
            await callRepo.AddAsync(call, CancellationToken);
        }

        var rows = await reader.GetCostEstimateAsync(new StatisticsFilter(), CancellationToken);

        var stat = rows.Single(r => r.EndpointId == endpoint.Id);
        var summed = new TokenUsage(
            usages.Aggregate(0UL, (acc, u) => acc + u.InputTokenCount),
            usages.Aggregate(0UL, (acc, u) => acc + u.OutputTokenCount),
            usages.Aggregate(0UL, (acc, u) => acc + u.CachedInputTokenCount));

        // Single source of truth: the estimate must match ModelEndpoint.CalculateCost (which divides
        // by 1M). Concretely TotalCostEur is ~0.0297 EUR here, not the ~29,700 EUR the pre-fix bug gave.
        stat.TotalCostEur.Should().Be(endpoint.CalculateCost(summed));
    }

    [TestMethod]
    public async Task GetLatency_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetLatencyAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetModelBreakdown_AfterSeed_ReturnsRowPerEndpoint()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var rows = await reader.GetModelBreakdownAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().NotBeEmpty();
        rows[0].CallCount.Should().BeGreaterThan(0);
    }

    [TestMethod]
    public async Task GetSummary_WithExcludeSystemAgents_DropsSystemAgentCalls()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();

        await gen.CreateAsync(CancellationToken);          // an ordinary user-agent call
        await SeedSystemAgentCall(services);               // a system-agent (Tracey/evaluator) call

        var all = await reader.GetSummaryAsync(new StatisticsFilter(), CancellationToken);
        var nonSystem = await reader.GetSummaryAsync(new StatisticsFilter(ExcludeSystemAgents: true), CancellationToken);

        all.TotalCalls.Should().Be(2);
        nonSystem.TotalCalls.Should().Be(1);
    }

    [TestMethod]
    public async Task GetAgentBreakdown_WithExcludeSystemAgents_OmitsSystemAgent()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();

        var userCall = await gen.CreateAsync(CancellationToken);
        var systemAgentId = await SeedSystemAgentCall(services);

        var rows = await reader.GetAgentBreakdownAsync(new StatisticsFilter(ExcludeSystemAgents: true), CancellationToken);

        rows.Select(r => r.AgentId).Should().Contain(userCall.Agent.Id).And.NotContain(systemAgentId);
    }

    private async Task<Guid> SeedSystemAgentCall(IServiceProvider services)
    {
        var systemAgent = await services.GetRequiredService<IAgentGenerator>()
            .CreateAsync("Tracey", systemPrompt: "internal", isSystemAgent: true, cancellationToken: CancellationToken);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var request = await services.GetRequiredService<IDomainObjectGenerator<Conversation>>().CreateAsync(CancellationToken);
        var response = await services.GetRequiredService<IDomainObjectGenerator<ICompletion>>().CreateAsync(CancellationToken);
        var createCall = services.GetRequiredService<IAgentCall.CreateNew>();
        var callRepo = services.GetRequiredService<IRepository<IAgentCall>>();

        var call = createCall(systemAgent, systemAgent.CurrentVersion, endpoint, request, response);
        await callRepo.AddAsync(call, CancellationToken);
        return systemAgent.Id;
    }

    [TestMethod]
    public async Task GetSummary_FilteredByUnknownAgent_ReturnsZeros()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var summary = await reader.GetSummaryAsync(new StatisticsFilter(AgentId: Guid.NewGuid()), CancellationToken);

        summary.TotalCalls.Should().Be(0);
    }

    [TestMethod]
    public async Task GetTokenUsage_SumsTokensAcrossCallsInSameBucket()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var a = await gen.CreateAsync(CancellationToken);
        var b = await gen.CreateAsync(CancellationToken);

        var rows = await reader.GetTokenUsageAsync(new StatisticsFilter(), StatisticsBucket.Daily, CancellationToken);

        long expectedInput =
            (long)(a.Response?.Usage?.InputTokenCount ?? 0) + (long)(b.Response?.Usage?.InputTokenCount ?? 0);
        rows.Sum(r => r.InputTokens ?? 0L).Should().Be(expectedInput);
    }

    [TestMethod]
    public async Task GetCallTrends_TotalTracesAcrossBuckets_EqualsSeededCount()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);

        var from = DateTimeOffset.UtcNow.AddHours(-1);
        var to = DateTimeOffset.UtcNow.AddHours(1);
        var trends = await reader.GetCallTrendsAsync(new StatisticsFilter(), 10, from, to, CancellationToken);

        trends.Traces.Should().HaveCount(10);
        trends.Traces.Sum().Should().Be(3d);
    }

    [TestMethod]
    public async Task GetAgentWindow_AggregatesOnlyThatAgentsCalls()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var call = await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken); // a different agent — must be excluded

        var (series, summary) = await reader.GetAgentWindowAsync(
            call.Agent.Id,
            DateTimeOffset.UtcNow.AddHours(-1),
            DateTimeOffset.UtcNow.AddHours(1),
            StatisticsBucket.Hourly,
            CancellationToken);

        summary.TotalTraces.Should().Be(1);
        summary.TotalInputTokens.Should().Be((long)(call.Response?.Usage?.InputTokenCount ?? 0));
        series.Sum(p => p.TraceCount).Should().Be(1);
    }

    [TestMethod]
    public async Task GetAgentWindow_NoMatches_ReturnsEmptySeriesAndZeroSummary()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var (series, summary) = await reader.GetAgentWindowAsync(
            Guid.NewGuid(),
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow,
            StatisticsBucket.Daily,
            CancellationToken);

        series.Should().BeEmpty();
        summary.TotalTraces.Should().Be(0);
    }
}
