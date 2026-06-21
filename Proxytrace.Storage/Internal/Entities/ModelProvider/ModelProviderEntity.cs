using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Storage.Internal.Entities.ModelProvider;

[StoredDomainEntity(typeof(IModelProvider))]
[Cacheable]
internal record ModelProviderEntity : Entity, IArchivableEntity
{
    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelProvider.IModelProvider.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelProvider.IModelProvider.Endpoint"/> stored as a string
    /// </summary>
    public required string Endpoint { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelProvider.IModelProvider.ApiKey"/>, encrypted at rest via
    /// <c>ISecretProtector</c>. Holds ciphertext; the plaintext is recovered on read so it can be
    /// replayed to the upstream provider.
    /// </summary>
    public required string ApiKey { get; init; }

    /// <summary>
    /// Deterministic blind-index hash (<c>ISecretHasher</c>) of the upstream key, for
    /// <c>FindByApiKeyAsync</c> — the encrypted <see cref="ApiKey"/> ciphertext is non-deterministic
    /// and cannot be indexed or looked up directly. Null on a pre-retrofit row until the startup
    /// backfill sets it (the null marks an un-migrated, still-plaintext <see cref="ApiKey"/>).
    /// </summary>
    public string? ApiKeyLookupHash { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ModelProvider.IModelProvider.Kind"/>
    /// </summary>
    public required ModelProviderKind Kind { get; init; }

    /// <inheritdoc />
    public bool IsArchived { get; init; }
}
