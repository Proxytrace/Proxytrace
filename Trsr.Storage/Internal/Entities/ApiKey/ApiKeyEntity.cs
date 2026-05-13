using Trsr.Domain.ApiKey;

namespace Trsr.Storage.Internal.Entities.ApiKey;

[StoredDomainEntity(typeof(IApiKey))]
[Cacheable]
internal record ApiKeyEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.ApiKey.IApiKey.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ApiKey.IApiKey.ApiKey"/>
    /// </summary>
    public required string ApiKey { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ApiKey.IApiKey.Project"/>
    /// </summary>
    public required Guid Project { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ApiKey.IApiKey.Provider"/>
    /// </summary>
    public required Guid Provider { get; init; }
}
