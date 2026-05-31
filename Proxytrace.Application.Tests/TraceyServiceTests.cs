using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Tracey;
using Proxytrace.Application.Tracey.Internal;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Project;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class TraceyServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task EnsureTraceyAgentAsync_WhenAbsent_CreatesSystemAgent()
    {
        IServiceProvider services = GetServices(RegisterTracey);
        var project = await CreateProjectAsync(services);
        var definition = services.GetRequiredService<ITraceyDefinition>();
        var provisioner = services.GetRequiredService<ITraceyAgentProvisioner>();

        var agent = await provisioner.EnsureTraceyAgentAsync(project, CancellationToken);

        agent.Name.Should().Be(definition.Name);
        agent.IsSystemAgent.Should().BeTrue();
        agent.Project.Id.Should().Be(project.Id);
        agent.Tools.Should().HaveCount(definition.Tools.Count);
        agent.SystemPrompt.Template.Should().Be(definition.SystemPrompt);
    }

    [TestMethod]
    public async Task EnsureTraceyAgentAsync_WhenCalledTwice_IsIdempotent()
    {
        IServiceProvider services = GetServices(RegisterTracey);
        var project = await CreateProjectAsync(services);
        var provisioner = services.GetRequiredService<ITraceyAgentProvisioner>();

        var first = await provisioner.EnsureTraceyAgentAsync(project, CancellationToken);
        var second = await provisioner.EnsureTraceyAgentAsync(project, CancellationToken);

        second.Id.Should().Be(first.Id);
    }

    [TestMethod]
    public async Task CreateSessionAsync_MintsProjectScopedKeyExpiringInOneHour()
    {
        IServiceProvider services = GetServices(RegisterTracey);
        var project = await CreateProjectAsync(services);
        var sessionService = services.GetRequiredService<ITraceySessionService>();
        var apiKeys = services.GetRequiredService<IApiKeyRepository>();

        var session = await sessionService.CreateSessionAsync(project, CancellationToken);

        var stored = await apiKeys.FindByKeyAsync(session.ApiKey, CancellationToken);
        stored.Should().NotBeNull();
        stored!.Project.Id.Should().Be(project.Id);
        stored.Provider.Id.Should().Be(project.SystemEndpoint.Provider.Id);
        stored.ExpiresAt.Should().NotBeNull();
        stored.ExpiresAt!.Value.Should().BeCloseTo(DateTimeOffset.UtcNow.AddHours(1), TimeSpan.FromMinutes(1));
    }

    [TestMethod]
    public async Task CreateSessionAsync_ReturnsModelAgentAndScopedProxyUrl()
    {
        IServiceProvider services = GetServices(RegisterTracey);
        var project = await CreateProjectAsync(services);
        var sessionService = services.GetRequiredService<ITraceySessionService>();
        var provisioner = services.GetRequiredService<ITraceyAgentProvisioner>();
        var traceyAgent = await provisioner.EnsureTraceyAgentAsync(project, CancellationToken);

        var session = await sessionService.CreateSessionAsync(project, CancellationToken);

        session.Model.Should().Be(project.SystemEndpoint.Model.Name);
        session.AgentId.Should().Be(traceyAgent.Id);
        session.ProxyBaseUrl.Should().StartWith("http://localhost:5002/");
        session.ProxyBaseUrl.Should().EndWith("/openai/v1");
    }

    private async Task<IProject> CreateProjectAsync(IServiceProvider services)
        => await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

    private static void RegisterTracey(ContainerBuilder builder)
    {
        builder.RegisterType<TraceyDefinition>().As<ITraceyDefinition>().SingleInstance();
        builder.RegisterType<TraceyAgentProvisioner>().As<ITraceyAgentProvisioner>().SingleInstance();
        builder.RegisterType<TraceySessionService>().As<ITraceySessionService>().SingleInstance();
        builder.RegisterInstance<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Tracey:ProxyBaseUrl"] = "http://localhost:5002",
            })
            .Build());
    }
}
