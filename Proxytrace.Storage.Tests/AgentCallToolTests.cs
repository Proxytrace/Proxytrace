using System.Net;
using AwesomeAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Usage;
using Proxytrace.Storage.Internal.Entities.AgentCall;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

/// <summary>
/// Tests for the per-call tool-name projection (<see cref="AgentCallToolEntity"/>): the ToolName
/// filter clause and the distinct/sorted tool-name picker query. Cascade delete of the child rows
/// on trace deletion is asserted on EF model metadata in
/// <see cref="CascadeDeleteBehaviorModelTests.AgentCallToolToAgentCall_IsCascade_SoDeletingATraceRemovesItsToolRows"/>,
/// not here — the in-memory provider's client-side cascade only touches entities already tracked
/// in the change tracker, and <c>AbstractRepository.RemoveAsync</c> loads the parent by primary key
/// only (no <c>Include(Tools)</c>), so a round-trip delete test against the in-memory provider
/// would not exercise the real (PostgreSQL, database-enforced) cascade path at all.
/// </summary>
[TestClass]
public sealed class AgentCallToolTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetFilteredList_FilterByToolName_ReturnsOnlyCallsThatRequestedIt()
    {
        IServiceProvider services = GetServices();
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var repo = services.GetRequiredService<IAgentCallRepository>();

        var withSearch = await SeedCallWithToolsAsync(services, agent, ["web_search", "get_weather"]);
        await SeedCallWithToolsAsync(services, agent, ["get_weather"]);

        var (matching, matchingTotal) = await repo.GetFilteredListAsync(
            new AgentCallFilter(ToolName: "web_search"), 1, 50, CancellationToken);
        matchingTotal.Should().Be(1);
        matching.Should().ContainSingle(i => i.Id == withSearch.Id);

        var (nonMatching, nonMatchingTotal) = await repo.GetFilteredListAsync(
            new AgentCallFilter(ToolName: "other"), 1, 50, CancellationToken);
        nonMatchingTotal.Should().Be(0);
        nonMatching.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetToolNamesAsync_ReturnsDistinctSortedNames_ScopedToProject()
    {
        IServiceProvider services = GetServices();
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var otherProjectAgent = await CreateAgentInNewProjectAsync(services);
        var repo = services.GetRequiredService<IAgentCallRepository>();

        await SeedCallWithToolsAsync(services, agent, ["web_search", "get_weather"]);
        await SeedCallWithToolsAsync(services, agent, ["web_search"]); // duplicate name — must not repeat in result
        await SeedCallWithToolsAsync(services, otherProjectAgent, ["send_email"]); // different project — must not leak

        var names = await repo.GetToolNamesAsync(agent.Project.Id, CancellationToken);

        names.Should().Equal("get_weather", "web_search");
    }

    [TestMethod]
    public async Task AddAsync_WithToolRequests_PersistsOneRowPerDistinctToolName()
    {
        IServiceProvider services = GetServices();
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var call = await SeedCallWithToolsAsync(services, agent, ["web_search", "get_weather", "web_search"]);

        var db = services.GetRequiredService<Func<StorageDbContext>>()();
        var rows = await db.Set<AgentCallToolEntity>().Where(t => t.AgentCallId == call.Id).ToListAsync(CancellationToken);

        rows.Select(r => r.ToolName).Should().BeEquivalentTo(["web_search", "get_weather"]);
        rows.Should().OnlyContain(r => r.ProjectId == agent.Project.Id);
    }

    private async Task<IAgent> CreateAgentInNewProjectAsync(IServiceProvider services)
    {
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var promptTemplate = await services.GetRequiredService<IDomainObjectGenerator<IPromptTemplate>>().CreateAsync(CancellationToken);
        var modelParameters = await services.GetRequiredService<IDomainObjectGenerator<IModelParameters>>().CreateAsync(CancellationToken);
        var agentRepository = services.GetRequiredService<IAgentRepository>();

        return await agentRepository.CreateWithInitialVersionAsync(
            name: Guid.NewGuid().ToString("N"),
            systemPrompt: promptTemplate,
            tools: [],
            project: project,
            endpoint: endpoint,
            modelParameters: modelParameters,
            isSystemAgent: false,
            cancellationToken: CancellationToken);
    }

    private async Task<IAgentCall> SeedCallWithToolsAsync(
        IServiceProvider services,
        IAgent agent,
        IReadOnlyList<string> toolNames)
    {
        var conversationGen = services.GetRequiredService<IDomainObjectGenerator<Conversation>>();
        var createCompletion = services.GetRequiredService<ICompletion.Create>();
        var request = await conversationGen.CreateAsync(CancellationToken);

        var assistantMessage = new AssistantMessage(
            [Content.FromText("ok")],
            toolNames.Select((name, i) => new ToolRequest($"tr{i}", name, "{}")).ToList());
        ICompletion response = createCompletion(assistantMessage, new TokenUsage(10, 10), TimeSpan.FromMilliseconds(50));

        IAgentCall call = services.GetRequiredService<IAgentCall.CreateNew>()(
            agent,
            agent.CurrentVersion,
            agent.Endpoint,
            request,
            response,
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null,
            modelParameters: agent.ModelParameters);

        var repo = services.GetRequiredService<IAgentCallRepository>();
        return await repo.AddAsync(call, CancellationToken);
    }
}
