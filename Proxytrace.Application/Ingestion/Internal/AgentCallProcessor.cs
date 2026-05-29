using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Prompt;

namespace Proxytrace.Application.Ingestion.Internal;

internal sealed class AgentCallProcessor : IAgentCallProcessor
{
    private readonly IAgentCallRepository agentCallRepository;
    private readonly IAgentCall.CreateNew createNewCall;
    private readonly IPromptTemplate.Create createPromptTemplate;
    private readonly IOpenAiCallParser parser;
    private readonly IAgentRepository agentRepository;
    private readonly IAgentVersionRepository versionRepository;
    private readonly IAgentVersionMatcher matcher;
    private readonly ITraceBroadcaster traceBroadcaster;
    private readonly ILogger<AgentCallProcessor> logger;

    public AgentCallProcessor(
        IAgentCallRepository agentCallRepository,
        IAgentCall.CreateNew createNewCall,
        IPromptTemplate.Create createPromptTemplate,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        IAgentVersionRepository versionRepository,
        IAgentVersionMatcher matcher,
        ITraceBroadcaster traceBroadcaster,
        ILogger<AgentCallProcessor> logger)
    {
        this.agentCallRepository = agentCallRepository;
        this.createNewCall = createNewCall;
        this.createPromptTemplate = createPromptTemplate;
        this.parser = parser;
        this.agentRepository = agentRepository;
        this.versionRepository = versionRepository;
        this.matcher = matcher;
        this.traceBroadcaster = traceBroadcaster;
        this.logger = logger;
    }

    public async Task IngestAsync(
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

            // ── Resolve version ────────────────────────────────────────────────
            var promptTemplate = createPromptTemplate("unknown", parsed.SystemMessage.ToString());

            IAgentVersion version;
            if (priorConversationCall is not null
                && parsed.Tools.Count == 0
                && string.Equals(
                    priorConversationCall.Version.SystemPrompt.Template,
                    promptTemplate.Template,
                    StringComparison.Ordinal))
            {
                // Continuation call without re-sent tools *and* identical system prompt: inherit
                // prior call's version verbatim.
                version = priorConversationCall.Version;
            }
            else
            {
                version = await ResolveVersionAsync(job, promptTemplate, parsed, cancellationToken);
            }

            var agent = await version.GetAgentAsync(cancellationToken);

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
                version: version,
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
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex) when (IsRetryable(ex))
        {
            // Concurrency races (unique-index trip on version fingerprint / version number) and
            // transient DB failures are retryable — rethrow so the messaging worker requeues.
            logger.LogWarning(ex, "Retryable storage error ingesting agent call (provider={Provider}, status={HttpStatus})",
                job.Provider.Name, job.HttpStatus);
            throw;
        }
        catch (Exception ex)
        {
            // Poison: malformed payload, validation failure, missing referenced entity. Drop.
            logger.LogWarning(ex, "Failed to ingest agent call (provider={Provider}, status={HttpStatus})",
                job.Provider.Name,
                job.HttpStatus);
        }
    }

    /// <summary>
    /// Retryable = anything the messaging worker should requeue. Includes EF Core's
    /// <c>DbUpdateException</c> (unique-index races, optimistic concurrency) and ADO.NET
    /// <c>DbException</c> (transient connectivity, deadlocks). Identified by type name to avoid
    /// taking a hard EF reference in the application layer.
    /// </summary>
    private static bool IsRetryable(Exception ex)
    {
        for (Exception? e = ex; e is not null; e = e.InnerException)
        {
            string name = e.GetType().Name;
            if (name is "DbUpdateException" or "DbUpdateConcurrencyException")
            {
                return true;
            }
            if (e is System.Data.Common.DbException)
            {
                return true;
            }
        }
        return false;
    }

    private async Task<IAgentVersion> ResolveVersionAsync(
        IngestJob job,
        IPromptTemplate promptTemplate,
        ParseResult parsed,
        CancellationToken cancellationToken)
    {
        // 1. Strict fingerprint hit -> reuse existing version.
        var strictHit = await versionRepository.FindByStrictFingerprintAsync(
            job.Project, promptTemplate, parsed.Tools, cancellationToken);
        if (strictHit is not null)
        {
            return strictHit;
        }

        // 2. Fuzzy match -> new version under the matched agent.
        var similar = await matcher.FindSimilarVersionAsync(
            job.Project, promptTemplate, parsed.Tools, cancellationToken);
        if (similar is not null)
        {
            var similarAgent = await similar.GetAgentAsync(cancellationToken);
            var updatedAgent = await similarAgent.CreateNewVersionAsync(
                promptTemplate, parsed.Tools, cancellationToken);
            return updatedAgent.CurrentVersion;
        }

        // 3. No similar agent -> brand-new agent + v1 (delegates to repository). We already
        // performed the strict-fingerprint lookup above; skip the redundant pre-check inside the
        // repository while still benefiting from its fingerprint-keyed lock + post-write race
        // recovery on the unique index.
        var newAgent = await agentRepository.GetOrCreateAsync(
            promptTemplate,
            parsed.Tools,
            job.Project,
            parsed.Endpoint,
            modelParameters: parsed.ModelParameters,
            skipStrictPreCheck: true,
            cancellationToken: cancellationToken);

        return newAgent.CurrentVersion;
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

        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(sessionId));
        return new Guid(hash);
    }
}
