using System.Net;
using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall.Internal;

internal class AgentCallGenerator : DomainEntityGenerator<IAgentCall>
{
    private static readonly IReadOnlyCollection<string> Models = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
    private readonly IAgentCall.CreateNew factory;
    private readonly IDomainObjectGenerator<TokenUsage> usageGenerator;

    public AgentCallGenerator(
        IAgentCall.CreateNew factory,
        IRepository<IAgentCall> repository,
        IDomainObjectGenerator<TokenUsage> usageGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.usageGenerator = usageGenerator;
    }

    public override async Task<IAgentCall> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var model = random.Any(Models);
        return factory(
            model: model,
            provider: "openai",
            request: $$$"""{"model":"{{{model}}}","messages":[{"role":"user","content":"{{{random.String()}}}"}]}""",
            response: null,
            usage: await usageGenerator.CreateAsync(cancellationToken),
            duration: random.TimeSpan(),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);
    }
}
