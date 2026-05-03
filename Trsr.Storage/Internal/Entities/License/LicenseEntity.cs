using Trsr.Domain.License;

namespace Trsr.Storage.Internal.Entities.License;

[StoredDomainEntity(typeof(ILicense))]
internal record LicenseEntity : Entity
{
    public required string EmailHash { get; init; }
    public required LicenseTier Tier { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
}
