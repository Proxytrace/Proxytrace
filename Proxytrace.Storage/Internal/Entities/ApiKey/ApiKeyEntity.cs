using Proxytrace.Domain.ApiKey;

namespace Proxytrace.Storage.Internal.Entities.ApiKey;

[StoredDomainEntity(typeof(IApiKey))]
[Cacheable]
internal record ApiKeyEntity : Entity
{
    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.ApiKey"/>
    /// </summary>
    public required string ApiKey { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.Project"/>
    /// </summary>
    public required Guid Project { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.Provider"/>
    /// </summary>
    public required Guid Provider { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.Scopes"/>
    /// </summary>
    public required ApiKeyScopes Scopes { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.Owner"/>
    /// </summary>
    public required Guid Owner { get; init; }
}
