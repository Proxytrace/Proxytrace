using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.AgentCall.Internal;

internal class AgentCallGenerator : DomainEntityGenerator<IAgentCall>
{
    private static readonly string[] Models = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
    private readonly IAgentCall.CreateNew factory;

    public AgentCallGenerator(
        IAgentCall.CreateNew factory,
        IRepository<IAgentCall> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
    }

    public override Task<IAgentCall> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var model = random.Any(Models);
        return Task.FromResult(factory(
            model: model,
            provider: "openai",
            request: $$$"""{"model":"{{{model}}}","messages":[{"role":"user","content":"{{{random.String()}}}"}]}""",
            response: null,
            inputTokens: random.Int(50, 500),
            outputTokens: random.Int(20, 300),
            durationMs: random.Int(200, 3000),
            httpStatus: 200,
            finishReason: "stop",
            errorMessage: null));
    }
}
