using Proxytrace.Domain.Model;

namespace Proxytrace.Storage.Internal.Entities.Model;

[StoredDomainEntity(typeof(IModel))]
[Cacheable]
internal record ModelEntity : Entity
{
    /// <summary>
    /// <see cref="Proxytrace.Domain.Model.IModel.Name"/>
    /// </summary>
    public required string Name { get; init; }
}

