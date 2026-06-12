using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Proxytrace.Storage.Internal.Entities.Licensing;

internal class StoredLicenseConfig : AbstractEntityConfiguration<StoredLicenseEntity>
{
    public override void Configure(EntityTypeBuilder<StoredLicenseEntity> builder)
    {
    }
}
