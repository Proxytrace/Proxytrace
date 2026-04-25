namespace Trsr.Storage.Internal.Entities.Model;

[StoredDomainEntity(typeof(Trsr.Domain.Model.IModel))]
internal record ModelEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Model.IModel.Name"/>
    /// </summary>
    public required string Name { get; init; }
}

