using Proxytrace.Domain.Tools;

namespace Proxytrace.Application.Tracey;

/// <summary>
/// The canonical identity of the built-in Tracey assistant: her name, system prompt, and tool-set.
/// The stored Tracey <see cref="Domain.Agent.IAgent"/> mirrors these so her proxied LLM calls
/// auto-attribute to her agent, and the frontend tool runtime mirrors the same shapes in TypeScript.
/// </summary>
public interface ITraceyDefinition
{
    /// <summary>
    /// The canonical agent name used to find/seed Tracey within a project.
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Tracey's system prompt.
    /// </summary>
    string SystemPrompt { get; }

    /// <summary>
    /// Tracey's tool-set, mirroring <c>frontend/src/features/tracey/tracey-tools.ts</c>.
    /// </summary>
    IReadOnlyList<ToolSpecification> Tools { get; }
}
