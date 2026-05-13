using Trsr.Domain.Agent;
using Trsr.Domain.Tools;
using Trsr.Storage.Internal.Entities.Inference;

namespace Trsr.Storage.Internal.Entities.Agent;

internal record SystemPromptData(string Name, string Template);

[StoredDomainEntity(typeof(IAgent))]
[Cacheable]
internal record AgentEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Agent.IAgent.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.Agent.IAgent.Project"/>
    /// </summary>
    public required Guid Project { get; init; }

    public required Guid Endpoint { get; init; }

    /// <summary>
    /// SHA-256 fingerprint of system message + tools + model + provider, used for efficient get-or-create lookups.
    /// </summary>
    public required string Fingerprint { get; init; }

    /// <summary>
    /// <see cref="IAgent.SystemPrompt"/> - stored as JSON in the database
    /// </summary>
    public required SystemPromptData SystemPrompt { get; init; }

    /// <summary>
    /// <see cref="IAgent.IsSystemAgent"/>
    /// </summary>
    public required bool IsSystemAgent { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.Agent.IAgent.Tools"/> - stored as JSON in the database
    /// </summary>
    public required IReadOnlyList<ToolSpecification> Tools { get; init; }

    /// <summary>
    /// <see cref="IAgent.ModelParameters"/> - stored as JSON in the database
    /// </summary>
    public required ModelParametersData ModelParameters { get; init; }
}
