using System.Net;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Storage.Internal.Entities.AgentCall;

internal class AgentCallConfig : AbstractEntityConfiguration<AgentCallEntity>, IMapper<IAgentCall, AgentCallEntity>
{
    private readonly IAgentCall.CreateExisting factory;
    private readonly ISerializer serializer;
    private readonly IRepository<IAgent> agents;

    public AgentCallConfig(IAgentCall.CreateExisting factory, ISerializer serializer, IRepository<IAgent> agents)
    {
        this.factory = factory;
        this.serializer = serializer;
        this.agents = agents;
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

    public async Task<IAgentCall> Map(AgentCallEntity stored, CancellationToken cancellationToken = default)
    {
        IAgent? agent = stored.AgentId.HasValue
            ? await agents.GetAsync(stored.AgentId.Value, cancellationToken)
            : null;

        return factory(
            model: stored.Model,
            provider: stored.Provider,
            request: stored.Request,
            response: stored.Response,
            usage: new TokenUsage((ulong)stored.InputTokens, (ulong)stored.OutputTokens),
            duration: TimeSpan.FromMilliseconds(stored.DurationMs),
            httpStatus: (HttpStatusCode)stored.HttpStatus,
            finishReason: stored.FinishReason,
            errorMessage: stored.ErrorMessage,
            existing: stored,
            agent: agent);
    }

    public Task<AgentCallEntity> Map(IAgentCall domain, CancellationToken cancellationToken = default)
        => new AgentCallEntity
        {
            Id = domain.Id,
            AgentId = domain.Agent?.Id,
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
        }.ToTaskResult();
}
