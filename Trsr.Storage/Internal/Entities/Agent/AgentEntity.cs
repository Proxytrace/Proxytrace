using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Storage.Internal.Entities.Agent;

[StoredDomainEntity(typeof(Trsr.Domain.Agent.IAgent))]
internal record AgentEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Agent.IAgent.Project"/>
    /// </summary>
    public required Guid Project { get; init; }

    /// <summary>
    /// Human-readable name for the agent, generated automatically by an LLM during ingestion.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// SHA-256 fingerprint of system message + tools + model + provider, used for efficient get-or-create lookups.
    /// </summary>
    public required string Fingerprint { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.Agent.IAgent.SystemMessage"/> - stored as JSON in the database
    /// </summary>
    public required SystemMessage SystemMessage { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.Agent.IAgent.Tools"/> - stored as JSON in the database
    /// </summary>
    public required IReadOnlyCollection<ToolSpecification> Tools { get; init; }
}
