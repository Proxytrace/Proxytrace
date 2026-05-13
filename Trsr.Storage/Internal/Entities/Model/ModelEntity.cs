using Trsr.Domain.Model;

namespace Trsr.Storage.Internal.Entities.Model;

[StoredDomainEntity(typeof(IModel))]
[Cacheable]
internal record ModelEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Model.IModel.Name"/>
    /// </summary>
    public required string Name { get; init; }
}

