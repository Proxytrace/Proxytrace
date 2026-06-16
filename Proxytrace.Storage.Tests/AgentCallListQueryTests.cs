using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class AgentCallListQueryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetFilteredList_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();

        var (items, total) = await repo.GetFilteredListAsync(new AgentCallFilter(), 1, 50, CancellationToken);

        items.Should().BeEmpty();
        total.Should().Be(0);
    }

    [TestMethod]
    public async Task GetFilteredList_ReturnsResolvedMetadataForSeededCall()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var call = await gen.CreateAsync(CancellationToken);

        var (items, total) = await repo.GetFilteredListAsync(new AgentCallFilter(), 1, 50, CancellationToken);

        total.Should().Be(1);
        items.Should().ContainSingle();
        var item = items[0];
        item.Id.Should().Be(call.Id);
        item.AgentId.Should().Be(call.Agent.Id);
        item.AgentName.Should().Be(call.Agent.Name);
        item.ModelName.Should().Be(call.Endpoint.Model.Name);
        item.ProviderName.Should().Be(call.Endpoint.Provider.Name);
        item.HttpStatus.Should().Be((int)call.HttpStatus);
    }

    [TestMethod]
    public async Task GetFilteredList_PreviewMatchesFirstUserMessage()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var call = await gen.CreateAsync(CancellationToken);

        var expectedPreview = call.Request.Messages
            .OfType<Proxytrace.Domain.Message.UserMessage>()
            .FirstOrDefault()?.GetText();

        var (items, _) = await repo.GetFilteredListAsync(new AgentCallFilter(), 1, 50, CancellationToken);

        if (string.IsNullOrWhiteSpace(expectedPreview))
        {
            items[0].MessagePreview.Should().BeNull();
        }
        else
        {
            items[0].MessagePreview.Should().NotBeNullOrEmpty();
        }
    }

    [TestMethod]
    public async Task GetFilteredList_FiltersByAgent()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IAgentCallRepository>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var call = await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken); // unrelated agent

        var (items, total) = await repo.GetFilteredListAsync(
            new AgentCallFilter(AgentId: call.Agent.Id), 1, 50, CancellationToken);

        total.Should().Be(1);
        items.Should().ContainSingle(i => i.Id == call.Id);
    }
}
