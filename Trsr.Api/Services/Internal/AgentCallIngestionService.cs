using System.Net;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.Usage;

namespace Trsr.Api.Services.Internal;

internal class AgentCallIngestionService : IAgentCallIngestionService
{
    private readonly IAgentCallRepository repository;
    private readonly IAgentCall.CreateNew createNew;
    private readonly IAgentCall.CreateExisting createExisting;
    private readonly IOpenAiCallParser parser;
    private readonly IAgentRepository agentRepository;
    private readonly IModelEndpointRepository endpointRepository;
    private readonly ILogger<AgentCallIngestionService> logger;

    public AgentCallIngestionService(
        IAgentCallRepository repository,
        IAgentCall.CreateNew createNew,
        IAgentCall.CreateExisting createExisting,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        IModelEndpointRepository endpointRepository,
        ILogger<AgentCallIngestionService> logger)
    {
        this.repository = repository;
        this.createNew = createNew;
        this.createExisting = createExisting;
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

            var continuationOf = await repository
                .FindToolCallContinuationAsync(agent, parsed.Request, cancellationToken);

            if (continuationOf is not null)
            {
                var mergedUsage = new TokenUsage(
                    continuationOf.Usage.InputTokenCount + parsed.Usage.InputTokenCount,
                    continuationOf.Usage.OutputTokenCount + parsed.Usage.OutputTokenCount);

                var updated = createExisting(
                    agent: agent,
                    endpoint: endpoint,
                    request: parsed.Request,
                    response: parsed.Response,
                    usage: mergedUsage,
                    duration: continuationOf.Duration + parsed.Duration,
                    httpStatus: parsed.HttpStatus,
                    finishReason: parsed.FinishReason,
                    errorMessage: parsed.ErrorMessage,
                    existing: continuationOf);

                await repository.UpdateAsync(updated, cancellationToken);
                return;
            }

            var call = createNew(
                agent: agent,
                endpoint: endpoint,
                request: parsed.Request,
                response: parsed.Response,
                usage: parsed.Usage,
                duration: parsed.Duration,
                httpStatus: parsed.HttpStatus,
                finishReason: parsed.FinishReason,
                errorMessage: parsed.ErrorMessage);

            await repository.AddAsync(call, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to ingest agent call (provider={Provider}, status={HttpStatus})",
                provider, httpStatus);
        }
    }
}
