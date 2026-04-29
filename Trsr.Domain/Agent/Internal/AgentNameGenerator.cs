using JetBrains.Annotations;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Agent.Internal;

[UsedImplicitly]
internal class AgentNameGenerator : IAgentNameGenerator
{
    /// <inheritdoc />
    public Task<string> GenerateNameAsync(
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException();
    }
}
