using System.Net;
using Trsr.Common.Random;
using Trsr.Domain.Agent;
using Trsr.Domain.Completion;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.AgentCall.Internal;

internal class AgentCallGenerator : DomainEntityGenerator<IAgentCall>, IAgentCallGenerator
{
    private readonly IAgentCall.CreateNew factory;
    private readonly IAgentCall.CreateExisting createExisting;
    private readonly IDomainObjectGenerator<IAgent> agentGenerator;
    private readonly IDomainObjectGenerator<IModelEndpoint> endpointGenerator;
    private readonly IDomainObjectGenerator<Conversation> conversationGenerator;
    private readonly IDomainObjectGenerator<ICompletion> completionGenerator;

    public AgentCallGenerator(
        IAgentCall.CreateNew factory,
        IAgentCall.CreateExisting createExisting,
        IRepository<IAgentCall> repository,
        IDomainObjectGenerator<IAgent> agentGenerator,
        IDomainObjectGenerator<IModelEndpoint> endpointGenerator,
        IDomainObjectGenerator<Conversation> conversationGenerator,
        IDomainObjectGenerator<ICompletion> completionGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.createExisting = createExisting;
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

    public async Task<IAgentCall> CreateAsync(DateTimeOffset createdAt, CancellationToken cancellationToken = default)
    {
        var agentCall = await CreateAsync(cancellationToken);
        var modified = createExisting(
            agent: agentCall.Agent,
            endpoint: agentCall.Endpoint,
            request: agentCall.Request,
            response: agentCall.Response,
            httpStatus: agentCall.HttpStatus,
            finishReason: agentCall.FinishReason,
            errorMessage: agentCall.ErrorMessage,
            modelParameters: agentCall.ModelParameters,
            conversationId: agentCall.ConversationId,
            existing: new ModifiedDomainEntityData(agentCall.Id, CreatedAt: createdAt, agentCall.UpdatedAt));
        return await modified.UpdateAsync(cancellationToken);
    }   

    private record ModifiedDomainEntityData(Guid Id, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt) : IDomainEntityData;
}
