using Proxytrace.Domain.MfaBackupCode;

namespace Proxytrace.Storage.Internal.Entities.MfaBackupCode;

[StoredDomainEntity(typeof(IMfaBackupCode))]
internal record MfaBackupCodeEntity : Entity
{
    public required Guid User { get; init; }

    /// <summary><see cref="IMfaBackupCode.CodeHash"/> — SHA-256 of the raw code (verify-only).</summary>
    public required string CodeHash { get; init; }

    public DateTimeOffset? ConsumedAt { get; init; }
}
