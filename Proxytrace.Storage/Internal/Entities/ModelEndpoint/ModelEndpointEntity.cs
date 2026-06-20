using Proxytrace.Domain.ModelEndpoint;

namespace Proxytrace.Storage.Internal.Entities.ModelEndpoint;

[StoredDomainEntity(typeof(IModelEndpoint))]
[Cacheable]
internal record ModelEndpointEntity : Entity, IArchivableEntity
{
    /// <summary>
    /// FK to <see cref="Proxytrace.Storage.Internal.Entities.Model.ModelEntity"/>
    /// </summary>
    public required Guid Model { get; init; }

    /// <summary>
    /// FK to <see cref="Proxytrace.Storage.Internal.Entities.ModelProvider.ModelProviderEntity"/>
    /// </summary>
    public required Guid Provider { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelEndpoint.IModelEndpoint.InputTokenCost"/>
    /// </summary>
    public required decimal? InputTokenCost { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelEndpoint.IModelEndpoint.OutputTokenCost"/>
    /// </summary>
    public required decimal? OutputTokenCost { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelEndpoint.IModelEndpoint.CachedInputTokenCost"/>
    /// </summary>
    public required decimal? CachedInputTokenCost { get; init; }

    /// <inheritdoc />
    public bool IsArchived { get; init; }
}

