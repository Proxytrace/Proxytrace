using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Storage.Internal.Entities.AgentCall;

internal class AgentCallConfig : AbstractEntityConfiguration<AgentCallEntity>, IMapper<IAgentCall, AgentCallEntity>
{
    private readonly IAgentCall.CreateExisting factory;
    private readonly JsonSerializerOptions jsonOptions;

    public AgentCallConfig(IAgentCall.CreateExisting factory, IEnumerable<JsonConverter> converters)
    {
        this.factory = factory;
        jsonOptions = new JsonSerializerOptions();
        foreach (var converter in converters)
            jsonOptions.Converters.Add(converter);
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
    {
        var conversation = JsonSerializer.Deserialize<Conversation>(stored.ConversationJson, jsonOptions)!;
        var agentMessage = JsonSerializer.Deserialize<AssistantMessage>(stored.AgentMessageJson, jsonOptions)!;
        return factory(new AgentCallData(stored, conversation, agentMessage));
    }

    public AgentCallEntity Map(IAgentCall domain)
        => new()
        {
            Id = domain.Id,
            Model = domain.Model,
            Provider = domain.Provider,
            ConversationJson = JsonSerializer.Serialize(domain.Conversation, jsonOptions),
            AgentMessageJson = JsonSerializer.Serialize(domain.AgentMessage, jsonOptions),
            InputTokens = (int)domain.Usage.InputTokenCount,
            OutputTokens = (int)domain.Usage.OutputTokenCount,
            DurationMs = (long)domain.Duration.TotalMilliseconds,
            HttpStatus = (int)domain.HttpStatus,
            FinishReason = domain.FinishReason,
            ErrorMessage = domain.ErrorMessage,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        };

    private sealed record AgentCallData(
        AgentCallEntity Entity,
        Conversation Conversation,
        AssistantMessage AgentMessage) : IAgentCallData
    {
        public Guid Id => Entity.Id;
        public DateTimeOffset CreatedAt => Entity.CreatedAt;
        public DateTimeOffset UpdatedAt => Entity.UpdatedAt;
        public string Model => Entity.Model;
        public string Provider => Entity.Provider;
        public TokenUsage Usage => Entity.Usage;
        public TimeSpan Duration => Entity.Duration;
        public HttpStatusCode HttpStatus => (HttpStatusCode)Entity.HttpStatus;
        public string? FinishReason => Entity.FinishReason;
        public string? ErrorMessage => Entity.ErrorMessage;
    }
}
