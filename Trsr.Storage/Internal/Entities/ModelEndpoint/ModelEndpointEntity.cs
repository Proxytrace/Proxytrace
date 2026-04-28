namespace Trsr.Storage.Internal.Entities.ModelEndpoint;

[StoredDomainEntity(typeof(Trsr.Domain.ModelEndpoint.IModelEndpoint))]
internal record ModelEndpointEntity : Entity
{
    /// <summary>
    /// FK to <see cref="Trsr.Storage.Internal.Entities.Model.ModelEntity"/>
    /// </summary>
    public required Guid Model { get; init; }

    /// <summary>
    /// FK to <see cref="Trsr.Storage.Internal.Entities.ModelProvider.ModelProviderEntity"/>
    /// </summary>
    public required Guid Provider { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ModelEndpoint.IModelEndpoint.InputTokenCost"/>
    /// </summary>
    public required decimal? InputTokenCost { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ModelEndpoint.IModelEndpoint.OutputTokenCost"/>
    /// </summary>
    public required decimal? OutputTokenCost { get; init; }
}

