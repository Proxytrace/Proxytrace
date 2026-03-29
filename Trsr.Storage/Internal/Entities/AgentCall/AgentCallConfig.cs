using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.AgentCall;

namespace Trsr.Storage.Internal.Entities.AgentCall;

internal class AgentCallConfig : AbstractEntityConfiguration<AgentCallEntity>, IMapper<IAgentCall, AgentCallEntity>
{
    private readonly IAgentCall.CreateExisting factory;

    public AgentCallConfig(IAgentCall.CreateExisting factory)
    {
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<AgentCallEntity> builder)
    {
        builder.HasIndex(e => e.Provider);
        builder.HasIndex(e => e.Model);
        builder.HasIndex(e => e.CreatedAt);

        builder.Property(e => e.Model).HasMaxLength(256);
        builder.Property(e => e.Provider).HasMaxLength(64);
        builder.Property(e => e.FinishReason).HasMaxLength(64);
        builder.Property(e => e.ErrorMessage).HasMaxLength(2048);
    }

    public IAgentCall Map(AgentCallEntity stored)
        => factory(stored);

    public AgentCallEntity Map(IAgentCall domain)
        => new()
        {
            Id = domain.Id,
            Model = domain.Model,
            Provider = domain.Provider,
            Request = domain.Request,
            Response = domain.Response,
            InputTokens = (int)domain.Usage.InputTokenCount,
            OutputTokens = (int)domain.Usage.OutputTokenCount,
            DurationMs = (long)domain.Duration.TotalMilliseconds,
            HttpStatus = (int)domain.HttpStatus,
            FinishReason = domain.FinishReason,
            ErrorMessage = domain.ErrorMessage,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        };
}