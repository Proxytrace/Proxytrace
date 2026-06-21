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
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.KeyHash"/> — SHA-256 of the inbound key (the key is
    /// verify-only, so only its hash is stored).
    /// </summary>
    public required string KeyHash { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ApiKey.IApiKey.KeyPrefix"/> — a non-secret display slice. Null on a
    /// pre-retrofit row until the startup backfill sets it (the null marks an un-migrated row whose
    /// <see cref="KeyHash"/> still holds the plaintext key).
    /// </summary>
    public string? KeyPrefix { get; init; }

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
