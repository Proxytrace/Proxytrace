using Trsr.Domain.Message;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Tools;

namespace Trsr.Api.Services;

/// <summary>
/// Generates a short, human-readable name for an agent based on its system message and tools.
/// </summary>
public interface IAgentNamingService
{
    /// <summary>
    /// Generates a name for the agent defined by <paramref name="systemMessage"/> and <paramref name="tools"/>,
    /// using the given <paramref name="provider"/> to call the LLM.
    /// Falls back to a heuristic name if the LLM call fails.
    /// </summary>
    Task<string> GenerateNameAsync(
        IModelProvider provider,
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        CancellationToken cancellationToken = default);
}
