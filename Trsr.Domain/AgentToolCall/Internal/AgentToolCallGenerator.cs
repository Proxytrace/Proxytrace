using Trsr.Common.Random;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;

namespace Trsr.Domain.AgentToolCall.Internal;

internal class AgentToolCallGenerator : DomainEntityGenerator<IAgentToolCall>
{
    private readonly IAgentToolCall.CreateNew factory;
    private readonly IDomainObjectGenerator<IAgentCall> agentCallGenerator;
    private readonly IDomainObjectGenerator<ToolRequest> toolRequestGenerator;

    public AgentToolCallGenerator(
        IAgentToolCall.CreateNew factory,
        IRepository<IAgentToolCall> repository,
        IDomainObjectGenerator<IAgentCall> agentCallGenerator,
        IDomainObjectGenerator<ToolRequest> toolRequestGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.agentCallGenerator = agentCallGenerator;
        this.toolRequestGenerator = toolRequestGenerator;
    }

    public override async Task<IAgentToolCall> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var request = await toolRequestGenerator.CreateAsync(cancellationToken);
        return factory(
            agentCall: await agentCallGenerator.CreateAsync(cancellationToken),
            toolCallId: request.Id,
            request: request,
            response: null,
            duration: null);
    }
}
