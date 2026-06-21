using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Proxytrace.Storage.Internal.Entities.EmailSettings;

internal class EmailSettingsConfig : AbstractEntityConfiguration<EmailSettingsEntity>
{
    public override void Configure(EntityTypeBuilder<EmailSettingsEntity> builder)
    {
    }
}
