using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Serialization;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Storage.Internal.Entities.AgentCall;

internal class AgentCallConfig : AbstractEntityConfiguration<AgentCallEntity>, IMapper<IAgentCall, AgentCallEntity>
{
    private readonly IAgentCall.CreateExisting factory;
    private readonly ISerializer serializer;

    public AgentCallConfig(IAgentCall.CreateExisting factory, ISerializer serializer)
    {
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<AgentCallEntity> builder)
    {
        builder.HasIndex(e => e.AgentId);
        builder.HasIndex(e => e.Provider);
        builder.HasIndex(e => e.Model);
        builder.HasIndex(e => e.CreatedAt);

        builder.Property(e => e.Model).HasMaxLength(256);
        builder.Property(e => e.Provider).HasMaxLength(64);
        builder.Property(e => e.FinishReason).HasMaxLength(64);
        builder.Property(e => e.ErrorMessage).HasMaxLength(2048);
        
        builder
            .Property(e => e.Request)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<Conversation>(v)
            );
        
        builder
            .Property(e => e.Response)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<AssistantMessage>(v)
            );
    }

    public IAgentCall Map(AgentCallEntity stored) 
        => factory(stored);

    public AgentCallEntity Map(IAgentCall domain)
        => new()
        {
            AgentId = domain.AgentId,
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
