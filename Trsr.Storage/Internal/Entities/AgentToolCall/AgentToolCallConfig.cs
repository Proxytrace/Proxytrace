using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.AgentToolCall;
using Trsr.Domain.Message;
using Trsr.Storage.Internal.Entities.AgentCall;

namespace Trsr.Storage.Internal.Entities.AgentToolCall;

internal class AgentToolCallConfig : AbstractEntityConfiguration<AgentToolCallEntity>, IMapper<IAgentToolCall, AgentToolCallEntity>
{
    private readonly IAgentToolCall.CreateExisting factory;
    private readonly ISerializer serializer;
    private readonly IRepository<IAgentCall> agentCalls;

    public AgentToolCallConfig(
        IAgentToolCall.CreateExisting factory,
        ISerializer serializer,
        IRepository<IAgentCall> agentCalls)
    {
        this.factory = factory;
        this.serializer = serializer;
        this.agentCalls = agentCalls;
    }

    public override void Configure(EntityTypeBuilder<AgentToolCallEntity> builder)
    {
        builder.HasIndex(e => e.AgentCallId);
        builder.HasIndex(e => e.ToolCallId);

        builder.Property(e => e.ToolCallId).HasMaxLength(128);

        builder
            .HasOne<AgentCallEntity>()
            .WithMany()
            .HasForeignKey(e => e.AgentCallId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .Property(e => e.Request)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<ToolRequest>(v));

        builder
            .Property(e => e.Response)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<ToolResponse>(v));
    }

    public async Task<IAgentToolCall> Map(AgentToolCallEntity stored, CancellationToken cancellationToken = default)
    {
        var agentCall = await agentCalls.GetAsync(stored.AgentCallId, cancellationToken);
        return factory(
            agentCall: agentCall,
            toolCallId: stored.ToolCallId,
            request: stored.Request,
            response: stored.Response,
            duration: stored.DurationMs.HasValue ? TimeSpan.FromMilliseconds(stored.DurationMs.Value) : null,
            existing: stored);
    }

    public Task<AgentToolCallEntity> Map(IAgentToolCall domain, CancellationToken cancellationToken = default)
        => new AgentToolCallEntity
        {
            Id = domain.Id,
            AgentCallId = domain.AgentCall.Id,
            ToolCallId = domain.ToolCallId,
            Request = domain.Request,
            Response = domain.Response,
            DurationMs = domain.Duration.HasValue ? (long)domain.Duration.Value.TotalMilliseconds : null,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
