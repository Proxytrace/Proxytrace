using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Domain.AgentVersion;

/// <summary>
/// Computes the strict and loose fingerprints used to identify and match agent versions.
/// </summary>
public interface IAgentVersionFingerprinter
{
    /// <summary>SHA-256 over the system prompt + sorted tools including descriptions.</summary>
    string Strict(IPromptTemplate systemPrompt, IReadOnlyCollection<ToolSpecification> tools);

    /// <summary>
    /// SHA-256 over the structural tool shape (name + JSON schema with descriptions stripped).
    /// The system prompt is intentionally not part of the hash so a small prompt edit still
    /// falls into the same shortlist for similarity matching.
    /// </summary>
    string Loose(IPromptTemplate systemPrompt, IReadOnlyCollection<ToolSpecification> tools);
}
