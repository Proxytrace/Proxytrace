using System.Net;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.AgentToolCall;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.Usage;

namespace Trsr.Api.Services.Internal;

internal class AgentCallIngestionService : IAgentCallIngestionService
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
    private readonly ILogger<AgentCallIngestionService> logger;

    public AgentCallIngestionService(
        IAgentCallRepository agentCallRepository,
        IAgentToolCallRepository toolCallRepository,
        IAgentCall.CreateNew createNewCall,
        IAgentCall.CreateExisting createExistingCall,
        IAgentToolCall.CreateNew createNewToolCall,
        IAgentToolCall.CreateExisting createExistingToolCall,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        IModelEndpointRepository endpointRepository,
        ILogger<AgentCallIngestionService> logger)
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
        this.logger = logger;
    }

    public async Task IngestAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken)
    {
        try
        {
            if (!parser.TryParse(provider, requestBody, responseBody, duration, httpStatus, out OpenAiCallParseResult? parsed))
            {
                return;
            }

            var endpoint = await endpointRepository
                .GetOrCreateAsync(parsed.Model, parsed.Provider, cancellationToken);

            var agent = await agentRepository.GetOrCreateAsync(
                parsed.SystemMessage,
                parsed.Tools,
                project,
                endpoint,
                cancellationToken);

            var toolMessages = parsed.Request.Messages.OfType<ToolMessage>().ToList();
            var toolMessageIds = toolMessages.Select(m => m.Id).ToList();

            var continuationOfId = await toolCallRepository
                .FindAgentCallIdByToolCallIdsAsync(toolMessageIds, agent, cancellationToken);

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
                    existing: existing);

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
                    errorMessage: parsed.ErrorMessage);

                persistedCall = await agentCallRepository.AddAsync(call, cancellationToken);
            }

            await CreatePendingToolCallsAsync(persistedCall, parsed.Response, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to ingest agent call (provider={Provider}, status={HttpStatus})",
                provider, httpStatus);
        }
    }

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
}
