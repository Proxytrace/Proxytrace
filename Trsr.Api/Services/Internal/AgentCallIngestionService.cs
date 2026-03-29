using System.Net;
using System.Text.Json;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Usage;

namespace Trsr.Api.Services.Internal;

internal class AgentCallIngestionService : IAgentCallIngestionService
{
    private readonly IRepository<IAgentCall> repository;
    private readonly IAgentCall.CreateNew factory;
    private readonly ILogger<AgentCallIngestionService> logger;

    public AgentCallIngestionService(
        IRepository<IAgentCall> repository,
        IAgentCall.CreateNew factory,
        ILogger<AgentCallIngestionService> logger)
    {
        this.repository = repository;
        this.factory = factory;
        this.logger = logger;
    }

    public async Task IngestAsync(
        string provider,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken)
    {
        try
        {
            var model = ParseModel(requestBody);
            var (inputTokens, outputTokens, finishReason) = ParseResponse(responseBody);
            var errorMessage = (int)httpStatus >= 400 ? ParseErrorMessage(responseBody) : null;

            var call = factory(
                model: model,
                provider: provider,
                request: requestBody,
                response: responseBody,
                usage: new TokenUsage((ulong)(inputTokens ?? 0), (ulong)(outputTokens ?? 0)),
                duration: duration,
                httpStatus: httpStatus,
                finishReason: finishReason,
                errorMessage: errorMessage);

            await repository.AddAsync(call, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to ingest agent call (provider={Provider}, status={HttpStatus})",
                provider, httpStatus);
        }
    }

    private static string ParseModel(string requestBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(requestBody);
            if (doc.RootElement.TryGetProperty("model", out var model))
                return model.GetString() ?? "unknown";
        }
        catch { /* ignored */ }
        return "unknown";
    }

    private static (int? inputTokens, int? outputTokens, string? finishReason) ParseResponse(string? responseBody)
    {
        if (responseBody is null) return (null, null, null);
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            int? inputTokens = null;
            int? outputTokens = null;
            string? finishReason = null;

            if (root.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("prompt_tokens", out var pt)) inputTokens = pt.GetInt32();
                if (usage.TryGetProperty("completion_tokens", out var ct)) outputTokens = ct.GetInt32();
            }

            if (root.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0)
            {
                var first = choices[0];
                if (first.TryGetProperty("finish_reason", out var fr) && fr.ValueKind != JsonValueKind.Null)
                    finishReason = fr.GetString();
            }

            return (inputTokens, outputTokens, finishReason);
        }
        catch { return (null, null, null); }
    }

    private static string? ParseErrorMessage(string? responseBody)
    {
        if (responseBody is null) return null;
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var msg))
                return msg.GetString();
        }
        catch { /* ignored */ }
        return null;
    }
}
