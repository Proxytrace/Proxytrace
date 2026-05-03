namespace Trsr.Domain.License;

public interface ILicense : IDomainEntity
{
    string EmailHash { get; }
    LicenseTier Tier { get; }
    DateTimeOffset? ExpiresAt { get; }
    bool IsExpired { get; }

    public delegate ILicense CreateNew(string emailHash, LicenseTier tier, DateTimeOffset? expiresAt);
    public delegate ILicense CreateExisting(string emailHash, LicenseTier tier, DateTimeOffset? expiresAt, IDomainEntityData existing);
}
