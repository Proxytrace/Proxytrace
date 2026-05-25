using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;

namespace Proxytrace.Application.Ingestion.Internal;

internal class AgentCallIngestor : BackgroundService, IAgentCallIngestor
{
    private readonly IAgentCallRepository agentCallRepository;
    private readonly IAgentCall.CreateNew createNewCall;
    private readonly IPromptTemplate.Create createPromptTemplate;
    private readonly IOpenAiCallParser parser;
    private readonly IAgentRepository agentRepository;
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
        IAgentCall.CreateNew createNewCall,
        IPromptTemplate.Create createPromptTemplate,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        ITraceBroadcaster traceBroadcaster,
        ILogger<AgentCallIngestor> logger)
    {
        this.agentCallRepository = agentCallRepository;
        this.createNewCall = createNewCall;
        this.createPromptTemplate = createPromptTemplate;
        this.parser = parser;
        this.agentRepository = agentRepository;
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
            var parsed = await parser.TryParse(
                job.Provider,
                job.RequestBody,
                job.ResponseBody,
                job.Duration,
                job.HttpStatus,
                cancellationToken);

            if (parsed == null)
            {
                return;
            }

            // ── Resolve conversation context ───────────────────────────────────
            var (conversationId, priorConversationCall) = await ResolveConversationAsync(
                job, cancellationToken);

            // ── Agent resolution ───────────────────────────────────────────────
            // When we detect a continuation and the client didn't re-send tool definitions,
            // inherit the agent from the prior call to avoid creating a duplicate agent.
            var agent = priorConversationCall is not null && parsed.Tools.Count == 0
                ? priorConversationCall.Agent
                : await agentRepository.GetOrCreateAsync(
                    createPromptTemplate("unknown", parsed.SystemMessage.ToString()),
                    parsed.Tools,
                    job.Project,
                    parsed.Endpoint,
                    modelParameters: parsed.ModelParameters,
                    cancellationToken: cancellationToken);

            if (agent.Endpoint.Id != parsed.Endpoint.Id)
            {
                agent = await agent.ChangeEndpoint(parsed.Endpoint, cancellationToken);
            }

            if (!agent.ModelParameters.Equals(parsed.ModelParameters))
            {
                agent = await agent.ChangeModelParameters(parsed.ModelParameters, cancellationToken);
            }

            var call = createNewCall(
                agent: agent,
                endpoint: parsed.Endpoint,
                request: parsed.Request,
                response: parsed.Response,
                httpStatus: parsed.HttpStatus,
                finishReason: parsed.FinishReason,
                errorMessage: parsed.ErrorMessage,
                modelParameters: parsed.ModelParameters,
                conversationId: conversationId);

            call = await agentCallRepository.AddAsync(call, cancellationToken);
            traceBroadcaster.Publish(TraceCreatedEvent.Create(call));
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