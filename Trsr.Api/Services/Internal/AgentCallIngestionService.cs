using System.Net;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Api.Services.Internal;

internal class AgentCallIngestionService : IAgentCallIngestionService
{
    private readonly IRepository<IAgentCall> repository;
    private readonly IAgentCall.CreateNew factory;
    private readonly IOpenAiCallParser parser;
    private readonly IAgentRepository agentRepository;
    private readonly IModelEndpointRepository endpointRepository;
    private readonly ILogger<AgentCallIngestionService> logger;

    public AgentCallIngestionService(
        IRepository<IAgentCall> repository,
        IAgentCall.CreateNew factory,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        IModelEndpointRepository endpointRepository,
        ILogger<AgentCallIngestionService> logger)
    {
        this.repository = repository;
        this.factory = factory;
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
                    cancellationToken);

            var call = factory(
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