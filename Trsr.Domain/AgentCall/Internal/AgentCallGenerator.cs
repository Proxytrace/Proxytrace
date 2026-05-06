using System.Net;
using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall.Internal;

internal class AgentCallGenerator : DomainEntityGenerator<IAgentCall>
{
    private readonly IAgentCall.CreateNew factory;
    private readonly IDomainObjectGenerator<IAgent> agentGenerator;
    private readonly IDomainObjectGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainObjectGenerator<TokenUsage> usageGenerator;
    private readonly IDomainObjectGenerator<Conversation> conversationGenerator;
    private readonly IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator;

    public AgentCallGenerator(
        IAgentCall.CreateNew factory,
        IRepository<IAgentCall> repository,
        IDomainObjectGenerator<IAgent> agentGenerator,
        IDomainObjectGenerator<IModelEndpoint> endpointGenerator,
        IDomainObjectGenerator<TokenUsage> usageGenerator,
        IDomainObjectGenerator<Conversation> conversationGenerator,
        IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.endpointGenerator = endpointGenerator;
        this.usageGenerator = usageGenerator;
        this.conversationGenerator = conversationGenerator;
        this.assistantMessageGenerator = assistantMessageGenerator;
    }

    public override async Task<IAgentCall> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            agent: await agentGenerator.CreateAsync(cancellationToken),
            endpoint: await endpointGenerator.CreateAsync(cancellationToken),
            request: await conversationGenerator.CreateAsync(cancellationToken),
            response: await assistantMessageGenerator.CreateAsync(cancellationToken),
            usage: await usageGenerator.CreateAsync(cancellationToken),
            duration: random.TimeSpan(),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null,
            conversationId: null);
}
