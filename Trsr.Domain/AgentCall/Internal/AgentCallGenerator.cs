using System.Net;
using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Completion;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.AgentCall.Internal;

internal class AgentCallGenerator : DomainEntityGenerator<IAgentCall>
{
    private readonly IAgentCall.CreateNew factory;
    private readonly IDomainObjectGenerator<IAgent> agentGenerator;
    private readonly IDomainObjectGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainObjectGenerator<Conversation> conversationGenerator;
    private readonly IDomainObjectGenerator<ICompletion> completionGenerator;

    public AgentCallGenerator(
        IAgentCall.CreateNew factory,
        IRepository<IAgentCall> repository,
        IDomainObjectGenerator<IAgent> agentGenerator,
        IDomainObjectGenerator<IModelEndpoint> endpointGenerator,
        IDomainObjectGenerator<Conversation> conversationGenerator,
        IDomainObjectGenerator<ICompletion> completionGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.agentGenerator = agentGenerator;
        this.endpointGenerator = endpointGenerator;
        this.conversationGenerator = conversationGenerator;
        this.completionGenerator = completionGenerator;
    }

    public override async Task<IAgentCall> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            agent: await agentGenerator.CreateAsync(cancellationToken),
            endpoint: await endpointGenerator.CreateAsync(cancellationToken),
            request: await conversationGenerator.CreateAsync(cancellationToken),
            response: await completionGenerator.CreateAsync(cancellationToken),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null,
            conversationId: null);
}
