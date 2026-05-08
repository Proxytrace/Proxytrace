using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class StatisticsQueryServiceTests : BaseTest<Module>
{
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
