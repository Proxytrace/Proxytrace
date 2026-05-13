using Trsr.Domain.ModelProvider;

namespace Trsr.Storage.Internal.Entities.ModelProvider;

[StoredDomainEntity(typeof(IModelProvider))]
[Cacheable]
internal record ModelProviderEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.ModelProvider.IModelProvider.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ModelProvider.IModelProvider.Endpoint"/> stored as a string
    /// </summary>
    public required string Endpoint { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ModelProvider.IModelProvider.ApiKey"/>
    /// </summary>
    public required string ApiKey { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ModelProvider.IModelProvider.Kind"/>
    /// </summary>
    public required ModelProviderKind Kind { get; init; }

}
