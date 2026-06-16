using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Proxytrace.Common.Async;
using Proxytrace.Common.Serialization;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Usage;
using Proxytrace.Storage.Internal.Entities.Agent;
using Proxytrace.Storage.Internal.Entities.AgentVersion;
using Proxytrace.Storage.Internal.Entities.Inference;
using Proxytrace.Storage.Internal.Entities.ModelEndpoint;

namespace Proxytrace.Storage.Internal.Entities.AgentCall;

internal class AgentCallConfig : AbstractEntityConfiguration<AgentCallEntity>, IMapper<IAgentCall, AgentCallEntity>
{
    private readonly IAgentCall.CreateExisting factory;
    private readonly IModelParameters.Create modelParametersFactory;
    private readonly ISerializer serializer;
    private readonly IRepository<IAgentVersion> versions;
    private readonly IRepository<IAgent> agents;
    private readonly ICompletion.Create completionFactory;
    private readonly IRepository<IModelEndpoint> endpoints;

    public AgentCallConfig(
        IAgentCall.CreateExisting factory,
        IModelParameters.Create modelParametersFactory,
        ISerializer serializer,
        IRepository<IAgentVersion> versions,
        IRepository<IAgent> agents,
        ICompletion.Create completionFactory,
        IRepository<IModelEndpoint> endpoints)
    {
        this.factory = factory;
        this.modelParametersFactory = modelParametersFactory;
        this.serializer = serializer;
        this.versions = versions;
        this.agents = agents;
        this.completionFactory = completionFactory;
        this.endpoints = endpoints;
    }

    private const int RequestPreviewMaxLength = 1000;

    public override void Configure(EntityTypeBuilder<AgentCallEntity> builder)
    {
        // Composite (AgentVersionId, CreatedAt): serves the agent/project-scoped trace list and
        // time-series (which filter by version then order/range by CreatedAt) in one index, and its
        // leading column still covers the agent-version foreign key.
        builder.HasIndex(e => new { e.AgentVersionId, e.CreatedAt });
        builder.HasIndex(e => e.EndpointId);

        builder
            .HasOne<AgentVersionEntity>()
            .WithMany()
            .HasForeignKey(e => e.AgentVersionId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(e => e.CreatedAt);
        builder.Property(e => e.FinishReason).HasMaxLength(64);
        builder.Property(e => e.ErrorMessage).HasMaxLength(2048);
        builder.Property(e => e.RequestPreview).HasMaxLength(RequestPreviewMaxLength);
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
            .Property(e => e.ModelParameters)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<ModelParametersData>(v) ?? ModelParametersData.Empty
            );

        builder
            .HasOne<ModelEndpointEntity>()
            .WithMany()
            .HasForeignKey(e => e.EndpointId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    public async Task<IAgentCall> Map(AgentCallEntity stored, CancellationToken cancellationToken = default)
    {
        IAgentVersion version = await versions.GetAsync(stored.AgentVersionId, cancellationToken);
        IAgent agent = await agents.GetAsync(version.AgentId, cancellationToken);
        IModelEndpoint endpoint = await endpoints.GetAsync(stored.EndpointId, cancellationToken);
        var completion =
            stored.Response is not null
                ? completionFactory(
                    stored.Response,
                    usage: TokenUsage.Create(stored.InputTokens, stored.OutputTokens),
                    latency: TimeSpan.FromMilliseconds(stored.LatencyMs ?? 0))
                : null;
        var modelParameters = AgentConfig.ToDomain(stored.ModelParameters, modelParametersFactory);
        return factory(
            agent: agent,
            version: version,
            endpoint: endpoint,
            request: stored.Request,
            response: completion,
            httpStatus: (HttpStatusCode)stored.HttpStatus,
            finishReason: stored.FinishReason,
            errorMessage: stored.ErrorMessage,
            modelParameters: modelParameters,
            existing: stored,
            conversationId: stored.ConversationId);
    }

    public Task<AgentCallEntity> Map(IAgentCall domain, CancellationToken cancellationToken = default)
        => new AgentCallEntity
        {
            Id = domain.Id,
            AgentVersionId = domain.Version.Id,
            EndpointId = domain.Endpoint.Id,
            Request = domain.Request,
            Response = domain.Response?.Response,
            InputTokens = domain.Response?.Usage?.InputTokenCount,
            OutputTokens = domain.Response?.Usage?.OutputTokenCount,
            LatencyMs = domain.Response?.Latency.TotalMilliseconds,
            HttpStatus = (int)domain.HttpStatus,
            FinishReason = domain.FinishReason,
            ErrorMessage = domain.ErrorMessage,
            ModelParameters = AgentConfig.ToData(domain.ModelParameters),
            ConversationId = domain.ConversationId,
            RequestPreview = BuildPreview(domain.Request),
            ResponseToolRequestCount = domain.Response?.Response is AssistantMessage assistant
                ? assistant.ToolRequests.Count
                : 0,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();

    /// <summary>
    /// First user message in the request, whitespace-collapsed and truncated, stored so the traces
    /// list renders a preview without loading the full request payload. Mirrors the API list mapper.
    /// </summary>
    private static string? BuildPreview(Conversation request)
    {
        string? text = request.Messages.OfType<UserMessage>().FirstOrDefault()?.GetText();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        string collapsed = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ").Trim();
        return collapsed.Length > RequestPreviewMaxLength
            ? collapsed[..RequestPreviewMaxLength]
            : collapsed;
    }
}
