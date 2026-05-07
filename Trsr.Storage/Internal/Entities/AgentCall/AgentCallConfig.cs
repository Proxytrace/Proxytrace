using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Usage;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.ModelEndpoint;

namespace Trsr.Storage.Internal.Entities.AgentCall;

internal class AgentCallConfig : AbstractEntityConfiguration<AgentCallEntity>, IMapper<IAgentCall, AgentCallEntity>
{
    private readonly IAgentCall.CreateExisting factory;
    private readonly ISerializer serializer;
    private readonly IRepository<IAgent> agents;
    private readonly ICompletion.Create completionFactory;
    private readonly IRepository<IModelEndpoint> endpoints;

    public AgentCallConfig(
        IAgentCall.CreateExisting factory,
        ISerializer serializer,
        IRepository<IAgent> agents,
        ICompletion.Create completionFactory,
        IRepository<IModelEndpoint> endpoints)
    {
        this.factory = factory;
        this.serializer = serializer;
        this.agents = agents;
        this.completionFactory = completionFactory;
        this.endpoints = endpoints;
    }

    public override void Configure(EntityTypeBuilder<AgentCallEntity> builder)
    {
        builder.HasIndex(e => e.AgentId);
        builder.HasIndex(e => e.EndpointId);

        builder
            .HasOne<AgentEntity>()
            .WithMany()
            .HasForeignKey(e => e.AgentId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(e => e.CreatedAt);
        builder.Property(e => e.FinishReason).HasMaxLength(64);
        builder.Property(e => e.ErrorMessage).HasMaxLength(2048);
        builder.HasIndex(e => e.ConversationId);

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

        builder
            .HasOne<ModelEndpointEntity>()
            .WithMany()
            .HasForeignKey(e => e.EndpointId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    public async Task<IAgentCall> Map(AgentCallEntity stored, CancellationToken cancellationToken = default)
    {
        IAgent agent = await agents.GetAsync(stored.AgentId, cancellationToken);
        IModelEndpoint endpoint = await endpoints.GetAsync(stored.EndpointId, cancellationToken);
        var completion =
            stored.Response is not null
                ? completionFactory(
                    stored.Response,
                    usage: TokenUsage.Create(stored.InputTokens, stored.OutputTokens),
                    latency: TimeSpan.FromMilliseconds(stored.LatencyMs ?? 0))
                : null;
        return factory(
            agent: agent,
            endpoint: endpoint,
            request: stored.Request,
            response: completion,
            httpStatus: (HttpStatusCode)stored.HttpStatus,
            finishReason: stored.FinishReason,
            errorMessage: stored.ErrorMessage,
            existing: stored,
            conversationId: stored.ConversationId);
    }

    public Task<AgentCallEntity> Map(IAgentCall domain, CancellationToken cancellationToken = default)
        => new AgentCallEntity
        {
            Id = domain.Id,
            AgentId = domain.Agent.Id,
            EndpointId = domain.Endpoint.Id,
            Request = domain.Request,
            Response = domain.Response?.Response,
            InputTokens = domain.Response?.Usage?.InputTokenCount,
            OutputTokens = domain.Response?.Usage?.OutputTokenCount,
            LatencyMs = domain.Response?.Latency.TotalMilliseconds,
            HttpStatus = (int)domain.HttpStatus,
            FinishReason = domain.FinishReason,
            ErrorMessage = domain.ErrorMessage,
            ConversationId = domain.ConversationId,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}