using System.Net;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Agent;
using Trsr.Domain.Project;

namespace Trsr.Api.Services.Internal;

internal class AgentCallIngestionService : IAgentCallIngestionService
{
    private readonly IRepository<IAgentCall> repository;
    private readonly IAgentCall.CreateNew factory;
    private readonly IOpenAiCallParser parser;
    private readonly IAgentRepository agentRepository;
    private readonly ILogger<AgentCallIngestionService> logger;

    public AgentCallIngestionService(
        IRepository<IAgentCall> repository,
        IAgentCall.CreateNew factory,
        IOpenAiCallParser parser,
        IAgentRepository agentRepository,
        ILogger<AgentCallIngestionService> logger)
    {
        this.repository = repository;
        this.factory = factory;
        this.parser = parser;
        this.agentRepository = agentRepository;
        this.logger = logger;
    }

    public async Task IngestAsync(
        string provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken)
    {
        try
        {
            OpenAiCallParseResult? parsed = parser.Parse(provider, requestBody, responseBody, duration, httpStatus);
            if (parsed is null)
            {
                return;
            }

            IAgent? agent = null;
            if (parsed.SystemMessage is not null)
            {
                agent = await agentRepository.GetOrCreateAsync(
                    parsed.SystemMessage,
                    parsed.Tools,
                    parsed.Model,
                    parsed.Provider,
                    project,
                    cancellationToken);
            }

            var call = factory(
                model: parsed.Model,
                provider: parsed.Provider,
                request: parsed.Request,
                response: parsed.Response,
                usage: parsed.Usage,
                duration: parsed.Duration,
                httpStatus: parsed.HttpStatus,
                finishReason: parsed.FinishReason,
                errorMessage: parsed.ErrorMessage,
                agent: agent);

            await repository.AddAsync(call, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to ingest agent call (provider={Provider}, status={HttpStatus})",
                provider, httpStatus);
        }
    }
}
