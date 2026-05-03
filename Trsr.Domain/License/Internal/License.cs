using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.License.Internal;

internal record License : DomainEntity, ILicense
{
    public string EmailHash { get; }
    public LicenseTier Tier { get; }
    public DateTimeOffset? ExpiresAt { get; }
    public bool IsExpired => ExpiresAt.HasValue && ExpiresAt.Value < DateTimeOffset.UtcNow;

    public License(string emailHash, LicenseTier tier, DateTimeOffset? expiresAt)
    {
        EmailHash = emailHash;
        Tier = tier;
        ExpiresAt = expiresAt;
    }

    public License(string emailHash, LicenseTier tier, DateTimeOffset? expiresAt, IDomainEntityData existing) : base(existing)
    {
        EmailHash = emailHash;
        Tier = tier;
        ExpiresAt = expiresAt;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.NotNullOrWhiteSpace(EmailHash, nameof(EmailHash));
        yield return Validation.Defined(Tier, nameof(Tier));
    }
}
