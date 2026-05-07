using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Agent;

/// <summary>
/// Generates a short, human-readable name for an agent from its system message, using the agent's own model endpoint.
/// </summary>
public interface IAgentNameGenerator
{
    Task<string> GenerateNameAsync(
        IPromptTemplate systemPrompt,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default);
}
