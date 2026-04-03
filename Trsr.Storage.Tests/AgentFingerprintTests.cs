using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

/// <summary>
/// Tests for agent fingerprinting and grouping behavior.
/// Verifies that traced calls are correctly grouped under the same agent when their
/// identity fields match, and that a new agent version is created when any field changes.
/// </summary>
[TestClass]
public sealed class AgentFingerprintTests : BaseTest<Module>
{
    protected override void ConfigureContainer(Autofac.ContainerBuilder builder)
    {
        base.ConfigureContainer(builder);
        builder.RegisterModule<Module>();
        builder.RegisterModule<Domain.Module>();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static async Task<IProject> CreateProjectAsync(IServiceProvider services, CancellationToken ct)
        => await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(ct);

    private static ToolSpecification MakeTool(string name)
        => new(name, $"{name} description", ToolArguments.None);

    // ── fingerprint determinism ───────────────────────────────────────────────

    [TestMethod]
    public void GetAgentFingerprint_SameInputs_ReturnsSameFingerprint()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();
        var msg  = new SystemMessage("You are a helpful assistant");
        var tools = (IReadOnlyCollection<ToolSpecification>)[MakeTool("search")];

        var fp1 = repo.GetAgentFingerprint(msg, tools, "gpt-4o", "openai");
        var fp2 = repo.GetAgentFingerprint(msg, tools, "gpt-4o", "openai");

        fp1.Should().Be(fp2);
    }

    [TestMethod]
    public void GetAgentFingerprint_IsLowercaseHex64Chars()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();
        var fp = repo.GetAgentFingerprint(new SystemMessage("test"), [], "gpt-4o", "openai");

        fp.Should().HaveLength(64);
        fp.Should().MatchRegex("^[0-9a-f]+$");
    }

    // ── version-sensitive changes ─────────────────────────────────────────────

    [TestMethod]
    public void GetAgentFingerprint_DifferentSystemMessage_ReturnsDifferentFingerprint()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();

        var fp1 = repo.GetAgentFingerprint(new SystemMessage("You are agent A"), [], "gpt-4o", "openai");
        var fp2 = repo.GetAgentFingerprint(new SystemMessage("You are agent B"), [], "gpt-4o", "openai");

        fp1.Should().NotBe(fp2);
    }

    [TestMethod]
    public void GetAgentFingerprint_DifferentModel_ReturnsDifferentFingerprint()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();
        var msg = new SystemMessage("You are a helpful assistant");

        var fp1 = repo.GetAgentFingerprint(msg, [], "gpt-4o", "openai");
        var fp2 = repo.GetAgentFingerprint(msg, [], "gpt-4o-mini", "openai");

        fp1.Should().NotBe(fp2);
    }

    [TestMethod]
    public void GetAgentFingerprint_DifferentProvider_ReturnsDifferentFingerprint()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();
        var msg = new SystemMessage("You are a helpful assistant");

        var fp1 = repo.GetAgentFingerprint(msg, [], "claude-sonnet-4-6", "anthropic");
        var fp2 = repo.GetAgentFingerprint(msg, [], "claude-sonnet-4-6", "bedrock");

        fp1.Should().NotBe(fp2);
    }

    [TestMethod]
    public void GetAgentFingerprint_DifferentTools_ReturnsDifferentFingerprint()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();
        var msg = new SystemMessage("You are a helpful assistant");

        var fp1 = repo.GetAgentFingerprint(msg, [MakeTool("search")], "gpt-4o", "openai");
        var fp2 = repo.GetAgentFingerprint(msg, [MakeTool("calculator")], "gpt-4o", "openai");

        fp1.Should().NotBe(fp2);
    }

    [TestMethod]
    public void GetAgentFingerprint_ToolOrderDoesNotMatter()
    {
        var services = GetServices();
        var repo = services.GetRequiredService<IAgentRepository>();
        var msg = new SystemMessage("You are a helpful assistant");
        var toolA = MakeTool("aaa");
        var toolB = MakeTool("bbb");

        var fp1 = repo.GetAgentFingerprint(msg, [toolA, toolB], "gpt-4o", "openai");
        var fp2 = repo.GetAgentFingerprint(msg, [toolB, toolA], "gpt-4o", "openai");

        fp1.Should().Be(fp2);
    }

    // ── GetOrCreateAsync grouping ─────────────────────────────────────────────

    [TestMethod]
    public async Task GetOrCreateAsync_SameInputs_ReturnsSameAgent()
    {
        var services = GetServices();
        var repo    = services.GetRequiredService<IAgentRepository>();
        var project = await CreateProjectAsync(services, CancellationToken);
        var msg     = new SystemMessage("You are a helpful assistant");

        var agent1 = await repo.GetOrCreateAsync(msg, [], "gpt-4o", "openai", project, CancellationToken);
        var agent2 = await repo.GetOrCreateAsync(msg, [], "gpt-4o", "openai", project, CancellationToken);

        agent1.Id.Should().Be(agent2.Id);
    }

    [TestMethod]
    public async Task GetOrCreateAsync_DifferentModel_CreatesSeparateAgent()
    {
        var services = GetServices();
        var repo    = services.GetRequiredService<IAgentRepository>();
        var project = await CreateProjectAsync(services, CancellationToken);
        var msg     = new SystemMessage("You are a helpful assistant");

        var agent1 = await repo.GetOrCreateAsync(msg, [], "gpt-4o", "openai", project, CancellationToken);
        var agent2 = await repo.GetOrCreateAsync(msg, [], "gpt-4o-mini", "openai", project, CancellationToken);

        agent1.Id.Should().NotBe(agent2.Id);
        agent1.Model.Should().Be("gpt-4o");
        agent2.Model.Should().Be("gpt-4o-mini");
    }

    [TestMethod]
    public async Task GetOrCreateAsync_DifferentProvider_CreatesSeparateAgent()
    {
        var services = GetServices();
        var repo    = services.GetRequiredService<IAgentRepository>();
        var project = await CreateProjectAsync(services, CancellationToken);
        var msg     = new SystemMessage("You are a helpful assistant");

        var agent1 = await repo.GetOrCreateAsync(msg, [], "claude-sonnet-4-6", "anthropic", project, CancellationToken);
        var agent2 = await repo.GetOrCreateAsync(msg, [], "claude-sonnet-4-6", "bedrock",    project, CancellationToken);

        agent1.Id.Should().NotBe(agent2.Id);
        agent1.Provider.Should().Be("anthropic");
        agent2.Provider.Should().Be("bedrock");
    }

    [TestMethod]
    public async Task GetOrCreateAsync_DifferentSystemMessage_CreatesSeparateAgent()
    {
        var services = GetServices();
        var repo    = services.GetRequiredService<IAgentRepository>();
        var project = await CreateProjectAsync(services, CancellationToken);

        var agent1 = await repo.GetOrCreateAsync(new SystemMessage("You are agent A"), [], "gpt-4o", "openai", project, CancellationToken);
        var agent2 = await repo.GetOrCreateAsync(new SystemMessage("You are agent B"), [], "gpt-4o", "openai", project, CancellationToken);

        agent1.Id.Should().NotBe(agent2.Id);
    }

    [TestMethod]
    public async Task GetOrCreateAsync_CreatedAgentHasCorrectFields()
    {
        var services = GetServices();
        var repo    = services.GetRequiredService<IAgentRepository>();
        var project = await CreateProjectAsync(services, CancellationToken);
        var msg     = new SystemMessage("You are a helpful assistant");

        var agent = await repo.GetOrCreateAsync(msg, [MakeTool("search")], "gpt-4o", "openai", project, CancellationToken);

        agent.Model.Should().Be("gpt-4o");
        agent.Provider.Should().Be("openai");
        agent.SystemMessage.Should().Be(msg);
        agent.Tools.Should().HaveCount(1);
        agent.Project.Id.Should().Be(project.Id);
    }

    [TestMethod]
    public async Task GetAgentFingerprint_OnAgent_MatchesComputedFingerprint()
    {
        var services = GetServices();
        var repo    = services.GetRequiredService<IAgentRepository>();
        var project = await CreateProjectAsync(services, CancellationToken);
        var msg     = new SystemMessage("You are a helpful assistant");

        var agent = await repo.GetOrCreateAsync(msg, [], "gpt-4o", "openai", project, CancellationToken);
        var expected = repo.GetAgentFingerprint(msg, [], "gpt-4o", "openai");

        repo.GetAgentFingerprint(agent).Should().Be(expected);
    }
}
