using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Proxytrace.Storage.Internal.Entities.OutlierSettings;

internal class OutlierSettingsConfig : AbstractEntityConfiguration<OutlierSettingsEntity>
{
    public override void Configure(EntityTypeBuilder<OutlierSettingsEntity> builder)
    {
    }
}
