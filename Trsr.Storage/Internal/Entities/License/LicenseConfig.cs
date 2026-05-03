using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain.License;

namespace Trsr.Storage.Internal.Entities.License;

internal class LicenseConfig : AbstractEntityConfiguration<LicenseEntity>, IMapper<ILicense, LicenseEntity>
{
    private readonly ILicense.CreateExisting factory;

    public LicenseConfig(ILicense.CreateExisting factory)
    {
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<LicenseEntity> builder)
    {
        builder.HasIndex(e => e.EmailHash).IsUnique();
        builder.Property(e => e.Tier).HasConversion<string>();
    }

    public Task<ILicense> Map(LicenseEntity stored, CancellationToken cancellationToken = default)
        => factory(stored.EmailHash, stored.Tier, stored.ExpiresAt, stored).ToTaskResult();

    public Task<LicenseEntity> Map(ILicense domain, CancellationToken cancellationToken = default)
        => new LicenseEntity
        {
            Id = domain.Id,
            EmailHash = domain.EmailHash,
            Tier = domain.Tier,
            ExpiresAt = domain.ExpiresAt,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
