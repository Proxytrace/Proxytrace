using Proxytrace.Domain.Agent;
using Proxytrace.Storage.Internal.Entities.Inference;

namespace Proxytrace.Storage.Internal.Entities.Agent;

internal record SystemPromptData(string Name, string Template);

[StoredDomainEntity(typeof(IAgent))]
[Cacheable]
internal record AgentEntity : Entity
{
    public required string Name { get; init; }
    public required Guid Project { get; init; }
    public required Guid Endpoint { get; init; }
    public required bool IsSystemAgent { get; init; }
    public required ModelParametersData ModelParameters { get; init; }

    /// <summary>The id of the version currently in effect for this agent. Null only during the
    /// brief window between agent insert and initial-version insert (see
    /// <c>AgentRepository.CreateWithInitialVersionAsync</c>).</summary>
    public Guid? CurrentVersionId { get; init; }
}
