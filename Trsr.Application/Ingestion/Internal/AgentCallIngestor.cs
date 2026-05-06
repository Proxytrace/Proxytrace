using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Application.Streaming;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.AgentToolCall;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.Usage;

namespace Trsr.Application.Ingestion.Internal;

internal class AgentCallIngestor : BackgroundService, IAgentCallIngestor
{
    private readonly IAgentCallRepository agentCallRepository;
    private readonly IAgentToolCallRepository toolCallRepository;
    private readonly IAgentCall.CreateNew createNewCall;
    private readonly IAgentCall.CreateExisting createExistingCall;
    private readonly IAgentToolCall.CreateNew createNewToolCall;
    private readonly IAgentToolCall.CreateExisting createExistingToolCall;
    private readonly IOpenAiCallParser parser;
    private readonly IAgentRepository agentRepository;
    private readonly IModelEndpointRepository endpointRepository;
    private readonly ITraceBroadcaster traceBroadcaster;
    private readonly ILogger<AgentCallIngestor> logger;

    private readonly Channel<IngestJob> channel = Channel.CreateUnbounded<IngestJob>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public AgentCallIngestor(
        IAgentCallRepository agentCallRepository,
        IAgentToolCallRepository toolCallRepository,
        IAgentCall.CreateNew createNewCall,
        IAgentCall.CreateExisting createExistingCall,
        IAgentToolCall.CreateNew createNewToolCall,
        IAgentToolCall.CreateExisting createExistingToolCall,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        IModelEndpointRepository endpointRepository,
        ITraceBroadcaster traceBroadcaster,
        ILogger<AgentCallIngestor> logger)
    {
        this.agentCallRepository = agentCallRepository;
        this.toolCallRepository = toolCallRepository;
        this.createNewCall = createNewCall;
        this.createExistingCall = createExistingCall;
        this.createNewToolCall = createNewToolCall;
        this.createExistingToolCall = createExistingToolCall;
        this.parser = parser;
        this.agentRepository = agentRepository;
        this.endpointRepository = endpointRepository;
        this.traceBroadcaster = traceBroadcaster;
        this.logger = logger;
    }

    public async Task IngestInBackgroundAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? sessionId = null,
        CancellationToken cancellationToken = default)
        => await channel.Writer.WriteAsync(
            new IngestJob(
                provider,
                project,
                requestBody,
                responseBody, 
                duration,
                httpStatus,
                sessionId),
            cancellationToken);

    private async Task CreatePendingToolCallsAsync(
        IAgentCall agentCall,
        AssistantMessage response,
        CancellationToken cancellationToken)
    {
        foreach (var toolRequest in response.ToolRequests)
        {
            var pending = createNewToolCall(
                agentCall: agentCall,
                toolCallId: toolRequest.Id,
                request: toolRequest,
                response: null,
                duration: null);

            await toolCallRepository.AddAsync(pending, cancellationToken);
        }
    }

    private async Task UpdateToolCallResponsesAsync(
        IAgentCall agentCall,
        IReadOnlyList<ToolMessage> toolMessages,
        CancellationToken cancellationToken)
    {
        if (toolMessages.Count == 0)
        {
            return;
        }

        var pendingByToolCallId = (await toolCallRepository
                .GetByAgentCallAsync(agentCall.Id, cancellationToken))
            .Where(tc => tc.Response is null)
            .ToLookup(tc => tc.ToolCallId);

        var arrivedAt = DateTimeOffset.UtcNow;

        foreach (var toolMessage in toolMessages)
        {
            var pending = pendingByToolCallId[toolMessage.Id].FirstOrDefault();
            if (pending is null)
            {
                continue;
            }

            var (id, contents) = toolMessage.Deconstruct();
            var response = new ToolResponse(id, contents, success: true, error: null);
            var inferredDuration = arrivedAt - pending.CreatedAt;
            var clampedDuration = inferredDuration < TimeSpan.Zero ? TimeSpan.Zero : inferredDuration;

            var updated = createExistingToolCall(
                agentCall: agentCall,
                toolCallId: pending.ToolCallId,
                request: pending.Request,
                response: response,
                duration: clampedDuration,
                existing: pending);

            await toolCallRepository.UpdateAsync(updated, cancellationToken);
        }
    }
    
    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (IngestJob job in channel.Reader.ReadAllAsync(cancellationToken))
            {
                try
                {
                    await IngestAsync(job, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to process ingestion job (status={HttpStatus})", job.HttpStatus);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }

    internal async Task IngestAsync(
        IngestJob job,
        CancellationToken cancellationToken)
    {
        try
        {
            if (!parser.TryParse(
                    job.Provider,
                    job.RequestBody,
                    job.ResponseBody,
                    job.Duration,
                    job.HttpStatus,
                    out OpenAiCallParseResult? parsed))
            {
                return;
            }

            var endpoint = await endpointRepository
                .GetOrCreateAsync(parsed.Model, parsed.Provider, cancellationToken);

            var toolMessages = parsed.Request.Messages.OfType<ToolMessage>().ToList();
            var toolMessageIds = toolMessages.Select(m => m.Id).ToList();

            var continuationOfId = await toolCallRepository
                .FindAgentCallIdByToolCallIdsAsync(toolMessageIds, job.Project, cancellationToken);

            // ── Resolve conversation context ───────────────────────────────────
            var (conversationId, priorConversationCall) = await ResolveConversationAsync(
                job, cancellationToken);

            // ── Agent resolution ───────────────────────────────────────────────
            // When we detect a continuation and the client didn't re-send tool definitions,
            // inherit the agent from the prior call to avoid creating a duplicate agent.
            var agent = priorConversationCall is not null && parsed.Tools.Count == 0
                ? priorConversationCall.Agent
                : await agentRepository.GetOrCreateAsync(
                    parsed.SystemMessage,
                    parsed.Tools,
                    job.Project,
                    endpoint,
                    cancellationToken);

            IAgentCall persistedCall;

            if (continuationOfId is { } existingId)
            {
                var existing = await agentCallRepository.GetAsync(existingId, cancellationToken);
                var mergedUsage = new TokenUsage(
                    existing.Usage.InputTokenCount + parsed.Usage.InputTokenCount,
                    existing.Usage.OutputTokenCount + parsed.Usage.OutputTokenCount);

                var updated = createExistingCall(
                    agent: agent,
                    endpoint: endpoint,
                    request: parsed.Request,
                    response: parsed.Response,
                    usage: mergedUsage,
                    duration: existing.Duration + parsed.Duration,
                    httpStatus: parsed.HttpStatus,
                    finishReason: parsed.FinishReason,
                    errorMessage: parsed.ErrorMessage,
                    existing: existing,
                    conversationId: conversationId ?? existing.ConversationId);

                persistedCall = await agentCallRepository.UpdateAsync(updated, cancellationToken);

                await UpdateToolCallResponsesAsync(persistedCall, toolMessages, cancellationToken);
            }
            else
            {
                var call = createNewCall(
                    agent: agent,
                    endpoint: endpoint,
                    request: parsed.Request,
                    response: parsed.Response,
                    usage: parsed.Usage,
                    duration: parsed.Duration,
                    httpStatus: parsed.HttpStatus,
                    finishReason: parsed.FinishReason,
                    errorMessage: parsed.ErrorMessage,
                    conversationId: conversationId);

                persistedCall = await agentCallRepository.AddAsync(call, cancellationToken);
                traceBroadcaster.Publish(TraceCreatedEvent.Create(persistedCall));
            }

            await CreatePendingToolCallsAsync(persistedCall, parsed.Response, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to ingest agent call (provider={Provider}, status={HttpStatus})",
                job.Provider.Name,
                job.HttpStatus);
        }
    }

    private async Task<(Guid? conversationId, IAgentCall? priorCall)> ResolveConversationAsync(
        IngestJob job,
        CancellationToken cancellationToken)
    {
        if (job.SessionId is not { } rawSessionId)
        {
            return (null, null);
        }

        var sessionGuid = ParseSessionId(rawSessionId);
        var prior = await agentCallRepository
            .FindLatestByConversationIdAsync(sessionGuid, job.Project, cancellationToken);
        return (sessionGuid, prior);
    }

    private static Guid ParseSessionId(string sessionId)
    {
        if (Guid.TryParse(sessionId, out var guid))
        {
            return guid;
        }

        // Non-UUID strings are hashed to a deterministic GUID so any string session ID works.
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(sessionId));
        return new Guid(hash);
    }

}
