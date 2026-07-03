using Proxytrace.Domain.Statistics;
using Proxytrace.Domain.AuditLog;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Usage;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class AgentCallsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAll_Empty_ReturnsEmptyPage()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().BeEmpty();
        result.Total.Should().Be(0);
    }

    [TestMethod]
    public async Task GetAll_ReturnsSeededCall()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle(c => c.Id == call.Id);
    }

    [TestMethod]
    public async Task Get_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Get(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Get_ExistingId_ReturnsDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var result = await controller.Get(call.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Id.Should().Be(call.Id);
    }

    [TestMethod]
    public async Task Get_FlaggedCall_CarriesOutlierFlags()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var createCall = services.GetRequiredService<IAgentCall.CreateNew>();
        var createCompletion = services.GetRequiredService<ICompletion.Create>();
        var conversation = Conversation.Create().With(new UserMessage([Content.FromText("hi")]));
        ICompletion completion = createCompletion(
            new AssistantMessage([Content.FromText("ok")], []),
            new TokenUsage(100, 10, 0),
            TimeSpan.FromMilliseconds(100));
        var call = await services.GetRequiredService<IAgentCallRepository>().AddAsync(
            createCall(
                agent: agent,
                version: agent.CurrentVersion,
                endpoint: agent.Endpoint,
                request: conversation,
                response: completion,
                httpStatus: System.Net.HttpStatusCode.OK,
                finishReason: "stop",
                errorMessage: null,
                modelParameters: agent.ModelParameters,
                outlierFlags: OutlierFlags.HighTokens | OutlierFlags.HighLatency),
            CancellationToken);

        var result = await controller.Get(call.Id, CancellationToken);

        // The detail drawer's anomaly banner reads this off the fat DTO — it must survive mapping.
        result.Value.Should().NotBeNull();
        result.Value.OutlierFlags.Should().Be((int)(OutlierFlags.HighTokens | OutlierFlags.HighLatency));
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(call.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task Delete_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    // ── cross-tenant authorization (#193) ─────────────────────────────────────

    [TestMethod]
    public async Task Get_WhenCallerCannotAccessProject_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services, DenyingGuard());

        var result = await controller.Get(call.Id, CancellationToken);

        // Existing trace, but the guard denies → hidden behind a 404 (no request/response disclosed).
        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Delete_WhenCallerCannotAccessProject_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services, DenyingGuard());

        var result = await controller.Delete(call.Id, CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
        // And it must not have been removed.
        (await services.GetRequiredService<IAgentCallRepository>().FindAsync(call.Id, CancellationToken))
            .Should().NotBeNull();
    }

    [TestMethod]
    public async Task GetAll_AsNonAdminWithoutAccessibleProjectFilter_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services, DenyingGuard());

        // No projectId filter + a non-admin scope → no cross-tenant rows leak.
        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().BeEmpty();
    }

    // ── tool-name filter + picker ──────────────────────────────────────────────

    [TestMethod]
    public async Task GetAll_FilterByToolName_ReturnsOnlyMatchingCall()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var matching = await SeedCallWithToolsAsync(services, agent, ["web_search", "get_weather"]);
        await SeedCallWithToolsAsync(services, agent, ["get_weather"]);

        var result = await controller.GetAll(toolName: "web_search", cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle(c => c.Id == matching.Id);
    }

    [TestMethod]
    public async Task GetToolNames_ReturnsDistinctSortedNamesForProject()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        await SeedCallWithToolsAsync(services, agent, ["web_search", "get_weather"]);

        var names = await controller.GetToolNames(agent.Project.Id, CancellationToken);

        names.Should().Equal("get_weather", "web_search");
    }

    [TestMethod]
    public async Task GetToolNames_WhenCallerCannotAccessProject_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        await SeedCallWithToolsAsync(services, agent, ["web_search"]);
        var controller = ResolveController(services, DenyingGuard());

        var names = await controller.GetToolNames(agent.Project.Id, CancellationToken);

        names.Should().BeEmpty();
    }

    private async Task<IAgentCall> SeedCallWithToolsAsync(
        IServiceProvider services,
        IAgent agent,
        IReadOnlyList<string> toolNames)
    {
        var createCall = services.GetRequiredService<IAgentCall.CreateNew>();
        var createCompletion = services.GetRequiredService<ICompletion.Create>();
        var conversation = Conversation.Create().With(new UserMessage([Content.FromText("hi")]));
        var assistantMessage = new AssistantMessage(
            [Content.FromText("ok")],
            toolNames.Select((name, i) => new ToolRequest($"tr{i}", name, "{}")).ToList());
        ICompletion completion = createCompletion(assistantMessage, new TokenUsage(100, 10, 0), TimeSpan.FromMilliseconds(100));

        return await services.GetRequiredService<IAgentCallRepository>().AddAsync(
            createCall(
                agent: agent,
                version: agent.CurrentVersion,
                endpoint: agent.Endpoint,
                request: conversation,
                response: completion,
                httpStatus: System.Net.HttpStatusCode.OK,
                finishReason: "stop",
                errorMessage: null,
                modelParameters: agent.ModelParameters),
            CancellationToken);
    }

    // A non-admin who is a member of nothing: every project is inaccessible, scope set is empty.
    private static Proxytrace.Api.Auth.IProjectAccessGuard DenyingGuard()
    {
        var guard = Substitute.For<Proxytrace.Api.Auth.IProjectAccessGuard>();
        guard.CanAccessProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(false);
        guard.GetAccessibleProjectIdsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyCollection<Guid>?>([]));
        return guard;
    }

    private static AgentCallsController ResolveController(IServiceProvider services)
        => ResolveController(services, services.GetRequiredService<Proxytrace.Api.Auth.IProjectAccessGuard>());

    private static AgentCallsController ResolveController(
        IServiceProvider services, Proxytrace.Api.Auth.IProjectAccessGuard guard) => new(
        services.GetRequiredService<IAgentCallRepository>(),
        services.GetRequiredService<IAgentRepository>(),
        services.GetRequiredService<IDashboardStatistics>(),
        services.GetRequiredService<ITraceBroadcaster>(),
        services.GetRequiredService<AgentCallDtoMapper>(),
        services.GetRequiredService<AgentDtoMapper>(),
        services.GetRequiredService<Proxytrace.Domain.AgentCall.IAgentCall.CreateNew>(),
        services.GetRequiredService<Proxytrace.Domain.Completion.ICompletion.Create>(),
        guard,
        NullLogger<Audit>.Instance);
}
