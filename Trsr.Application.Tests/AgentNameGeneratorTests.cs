using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Trsr.Application.Agent;
using Trsr.Domain.Agent;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;
using Trsr.Testing;

namespace Trsr.Application.Tests;

[TestClass]
public sealed class AgentNameGeneratorTests : BaseTest<Module>
{
    private static AgentNameGenerator Build(
        IModelClient modelClient,
        out IAgentRepository agentRepo,
        out IPromptTemplate template,
        out IProject project)
    {
        template = Substitute.For<IPromptTemplate>();
        template.Template.Returns("Generate a name for this agent.");

        var prompts = Substitute.For<IPromptTemplateRepository>();
        prompts.GetAsync("agent_name_generator", Arg.Any<CancellationToken>()).Returns(template);

        var endpoint = Substitute.For<IModelEndpoint>();
        project = Substitute.For<IProject>();
        project.Id.Returns(Guid.NewGuid());
        project.SystemEndpoint.Returns(endpoint);

        var agent = Substitute.For<IAgent>();
        agent.CreateClient(Arg.Any<IModelEndpoint?>(), Arg.Any<bool>()).Returns(modelClient);

        agentRepo = Substitute.For<IAgentRepository>();
        agentRepo.GetOrCreateAsync(
            systemPrompt: Arg.Any<IPromptTemplate>(),
            tools: Arg.Any<IReadOnlyList<ToolSpecification>>(),
            project: Arg.Any<IProject>(),
            endpoint: Arg.Any<IModelEndpoint>(),
            name: Arg.Any<string?>(),
            isSystemAgent: Arg.Any<bool>(),
            modelParameters: Arg.Any<Domain.Inference.IModelParameters?>(),
            cancellationToken: Arg.Any<CancellationToken>()).Returns(agent);

        return new AgentNameGenerator(prompts, agentRepo, NullLogger<AgentNameGenerator>.Instance);
    }

    private static IModelClient ClientReturning(string text)
    {
        var completion = Substitute.For<ICompletion>();
        completion.Response.Returns(new AssistantMessage([Content.FromText(text)], []));
        var client = Substitute.For<IModelClient>();
        client.CompleteAsync(
                Arg.Any<Conversation>(),
                Arg.Any<ModelOptions?>(),
                Arg.Any<IReadOnlyDictionary<string, string>?>(),
                Arg.Any<CancellationToken>())
            .Returns(completion);
        return client;
    }

    [TestMethod]
    public async Task GenerateNameAsync_ReturnsModelResponse()
    {
        var sut = Build(ClientReturning("Cool Agent"), out _, out var template, out var project);

        var name = await sut.GenerateNameAsync(template, project, CancellationToken);

        name.Should().Be("Cool Agent");
    }

    [TestMethod]
    public async Task GenerateNameAsync_UsesProjectSystemEndpointForGeneratorAgent()
    {
        var sut = Build(ClientReturning("X"), out var agentRepo, out var template, out var project);

        await sut.GenerateNameAsync(template, project, CancellationToken);

        await agentRepo.Received(1).GetOrCreateAsync(
            systemPrompt: Arg.Any<IPromptTemplate>(),
            tools: Arg.Is<IReadOnlyList<ToolSpecification>>(t => t.Count == 0),
            project: project,
            endpoint: project.SystemEndpoint,
            name: "agent_name_generator",
            isSystemAgent: true,
            modelParameters: Arg.Any<Domain.Inference.IModelParameters?>(),
            cancellationToken: Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GenerateNameAsync_WhenModelThrows_LogsAndRethrows()
    {
        var client = Substitute.For<IModelClient>();
        client.CompleteAsync(
                Arg.Any<Conversation>(),
                Arg.Any<ModelOptions?>(),
                Arg.Any<IReadOnlyDictionary<string, string>?>(),
                Arg.Any<CancellationToken>())
            .Throws(new InvalidOperationException("boom"));
        var sut = Build(client, out _, out var template, out var project);

        await sut.Invoking(g => g.GenerateNameAsync(template, project, CancellationToken))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("boom");
    }
}
