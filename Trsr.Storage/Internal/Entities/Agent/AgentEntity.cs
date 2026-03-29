using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Storage.Internal.Entities.Agent;

[StoredDomainEntity(typeof(IAgent))]
internal record AgentEntity : Entity, IAgent
{
    /// <summary>
    /// <see cref="IAgent.Project"/>
    /// </summary>
    public required Guid Project { get; set; }

    /// <summary>
    /// <see cref="IAgent.SystemMessage"/> - stored as JSON in the database
    /// </summary>
    public required SystemMessage SystemMessage { get; set; }

    /// <summary>
    /// <see cref="IAgent.Tools"/> - stored as JSON in the database
    /// </summary>
    public required IReadOnlyCollection<ToolSpecification> Tools { get; init; }
}
