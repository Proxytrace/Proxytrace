using Proxytrace.Domain.PasswordResetToken;

namespace Proxytrace.Storage.Internal.Entities.PasswordResetToken;

[StoredDomainEntity(typeof(IPasswordResetToken))]
internal record PasswordResetTokenEntity : Entity
{
    public required Guid User { get; init; }

    /// <summary>
    /// <see cref="IPasswordResetToken.TokenHash"/> — SHA-256 of the reset token (verify-only, so only
    /// its hash is stored).
    /// </summary>
    public required string TokenHash { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? ConsumedAt { get; init; }
}
