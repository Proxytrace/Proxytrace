using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Prompt;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;
using Trsr.Domain.Usage;

namespace Trsr.Application.Demo.Internal;

internal sealed class DemoDataSeeder : IHostedService
{
    private const string ResourcePrefix = "Trsr.Application.Demo.DemoData.";

    private readonly IServiceProvider serviceProvider;
    private readonly ILogger<DemoDataSeeder> logger;

    public DemoDataSeeder(IServiceProvider serviceProvider, ILogger<DemoDataSeeder> logger)
    {
        this.serviceProvider = serviceProvider;
        this.logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();

        var dbInitializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
        await dbInitializer.EnsureDatabaseReadyAsync(cancellationToken);

        var agentCallRepository = scope.ServiceProvider.GetRequiredService<IRepository<IAgentCall>>();
        if (await agentCallRepository.CountAsync(cancellationToken) > 0)
        {
            logger.LogInformation("Database already contains data — skipping demo data seeding");
            return;
        }

        logger.LogInformation("Database is empty — seeding demo data");

        var foundation = await new FoundationSeeder(scope.ServiceProvider).SeedAsync(cancellationToken);

        var serializer = scope.ServiceProvider.GetRequiredService<ISerializer>();
        var scenarios = await LoadScenariosAsync(serializer, cancellationToken);

        foreach (var (name, scenario) in scenarios)
        {
            logger.LogDebug("Seeding demo scenario: {ScenarioName}", name);
            await SeedScenarioAsync(scope.ServiceProvider, foundation, scenario, cancellationToken);
        }

        logger.LogInformation("Demo data seeding complete");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static async Task<IReadOnlyList<(string Name, AgentScenarioFile Scenario)>> LoadScenariosAsync(
        ISerializer serializer,
        CancellationToken cancellationToken)
    {
        var assembly = typeof(DemoDataSeeder).Assembly;
        var resourceNames = assembly
            .GetManifestResourceNames()
            .Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal) && n.EndsWith(".json", StringComparison.Ordinal))
            .OrderBy(n => n, StringComparer.Ordinal)
            .ToList();

        var result = new List<(string, AgentScenarioFile)>(resourceNames.Count);
        foreach (var resourceName in resourceNames)
        {
            await using var stream = assembly.GetManifestResourceStream(resourceName)
                ?? throw new InvalidOperationException($"Failed to load embedded resource: {resourceName}");
            var scenario = await serializer.DeserializeAsync<AgentScenarioFile>(stream, cancellationToken)
                ?? throw new InvalidOperationException($"Scenario file deserialised to null: {resourceName}");
            result.Add((resourceName[ResourcePrefix.Length..], scenario));
        }
        return result;
    }

    private static async Task SeedScenarioAsync(
        IServiceProvider services,
        FoundationData foundation,
        AgentScenarioFile scenario,
        CancellationToken ct)
    {
        var endpoint = foundation.Endpoints[scenario.Agent.EndpointId];
        var data = new DemoEntityData(scenario.Agent.Id, scenario.Agent.CreatedAt, scenario.Agent.CreatedAt);
        var promptTemplateFactory = services.GetRequiredService<IPromptTemplate.Create>();
        
        var agentFactory = services.GetRequiredService<IAgent.CreateExisting>();
        var agent = await services.GetRequiredService<IRepository<IAgent>>()
            .UpsertAsync(agentFactory(
                name: scenario.Agent.Name,
                project: foundation.Project, 
                systemPrompt: promptTemplateFactory(scenario.Agent.Name, scenario.Agent.SystemMessage.ToString()),
                tools: scenario.Agent.Tools, 
                endpoint: endpoint,
                isSystemAgent: false,
                existing: data), ct);

        await SeedCallsAsync(services, agent, endpoint, scenario.Calls, ct);
        var testCases = await SeedTestCasesAsync(services, scenario.TestCases, ct);
        await SeedTestSuiteAsync(services, foundation, agent, testCases, scenario.TestSuite, ct);
    }

    private static async Task SeedCallsAsync(
        IServiceProvider services,
        IAgent agent,
        IModelEndpoint endpoint,
        IReadOnlyList<AgentCallSeedData> calls,
        CancellationToken ct)
    {
        var factory = services.GetRequiredService<IAgentCall.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<IAgentCall>>();
        foreach (var call in calls)
        {
            var data = new DemoEntityData(call.Id, call.CreatedAt, call.CreatedAt);
            var entity = factory(
                agent,
                endpoint,
                call.Request,
                call.Response,
                new TokenUsage(call.InputTokens, call.OutputTokens),
                TimeSpan.FromMilliseconds(call.DurationMs),
                (HttpStatusCode)call.HttpStatus,
                call.FinishReason,
                call.ErrorMessage,
                data,
                conversationId: null);
            await repo.UpsertAsync(entity, ct);
        }
    }

    private static async Task<IReadOnlyDictionary<Guid, ITestCase>> SeedTestCasesAsync(
        IServiceProvider services,
        IReadOnlyList<TestCaseSeedData> testCases,
        CancellationToken ct)
    {
        var factory = services.GetRequiredService<ITestCase.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<ITestCase>>();
        var result = new Dictionary<Guid, ITestCase>();
        foreach (var tc in testCases)
        {
            var data = new DemoEntityData(tc.Id, tc.CreatedAt, tc.CreatedAt);
            var entity = await repo.UpsertAsync(factory(tc.Input, tc.ExpectedOutput, data), ct);
            result[tc.Id] = entity;
        }
        return result;
    }

    private static async Task SeedTestSuiteAsync(
        IServiceProvider services,
        FoundationData foundation,
        IAgent agent,
        IReadOnlyDictionary<Guid, ITestCase> testCases,
        TestSuiteSeedData suite,
        CancellationToken ct)
    {
        var factory = services.GetRequiredService<ITestSuite.CreateExisting>();
        var repo = services.GetRequiredService<IRepository<ITestSuite>>();
        var data = new DemoEntityData(suite.Id, suite.CreatedAt, suite.CreatedAt);
        await repo.UpsertAsync(factory(suite.Name, agent, [foundation.Evaluator], testCases.Values.ToList(), data), ct);
    }
}
