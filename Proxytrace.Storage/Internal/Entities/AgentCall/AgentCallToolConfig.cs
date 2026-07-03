using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Proxytrace.Storage.Internal.Entities.AgentCall;

internal class AgentCallToolConfig : AbstractEntityConfiguration<AgentCallToolEntity>
{
    public override void Configure(EntityTypeBuilder<AgentCallToolEntity> builder)
    {
        builder.Property(t => t.ToolName).HasMaxLength(256);

        builder
            .HasOne<AgentCallEntity>()
            .WithMany(e => e.Tools)
            .HasForeignKey(t => t.AgentCallId)
            .OnDelete(DeleteBehavior.Cascade);

        // Serves the tool-name picker's DISTINCT query (project-scoped, index-only scan).
        builder.HasIndex(t => new { t.ProjectId, t.ToolName });

        // Serves the EXISTS filter semi-join (AgentCallId == e.Id && ToolName == filter.ToolName).
        builder.HasIndex(t => new { t.ToolName, t.AgentCallId });
    }
}
