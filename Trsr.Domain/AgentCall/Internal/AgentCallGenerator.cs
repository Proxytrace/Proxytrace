using System.Net;
using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall.Internal;

internal class AgentCallGenerator : DomainEntityGenerator<IAgentCall>
{
    private static readonly IReadOnlyCollection<string> Models = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
    private readonly IAgentCall.CreateNew factory;
    private readonly IDomainObjectGenerator<TokenUsage> usageGenerator;
    private readonly IDomainObjectGenerator<Conversation> conversationGenerator;
    private readonly IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator;

    public AgentCallGenerator(
        IAgentCall.CreateNew factory,
        IRepository<IAgentCall> repository,
        IDomainObjectGenerator<TokenUsage> usageGenerator,
        IDomainObjectGenerator<Conversation> conversationGenerator,
        IDomainObjectGenerator<AssistantMessage> assistantMessageGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.usageGenerator = usageGenerator;
        this.conversationGenerator = conversationGenerator;
        this.assistantMessageGenerator = assistantMessageGenerator;
    }

    public override async Task<IAgentCall> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
            model: random.Any(Models),
            provider: "openai",
            request: await conversationGenerator.CreateAsync(cancellationToken),
            response: await assistantMessageGenerator.CreateAsync(cancellationToken),
            usage: await usageGenerator.CreateAsync(cancellationToken),
            duration: random.TimeSpan(),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);
}
