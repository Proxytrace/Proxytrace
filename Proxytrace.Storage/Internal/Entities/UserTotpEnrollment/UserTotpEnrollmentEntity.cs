using Proxytrace.Domain.UserTotpEnrollment;

namespace Proxytrace.Storage.Internal.Entities.UserTotpEnrollment;

[StoredDomainEntity(typeof(IUserTotpEnrollment))]
internal record UserTotpEnrollmentEntity : Entity
{
    public required Guid User { get; init; }

    /// <summary>
    /// <see cref="IUserTotpEnrollment.Secret"/> — the Base32 TOTP shared secret, stored as
    /// non-deterministic ciphertext (encrypted via <c>ISecretProtector</c> in the mapper).
    /// </summary>
    public required string Secret { get; init; }

    public DateTimeOffset? ConfirmedAt { get; init; }
    public long? LastUsedStep { get; init; }
}
