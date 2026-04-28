using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Trsr.Api.Services;
using Trsr.Domain.Message;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Tools;

namespace Trsr.Api.Services.Internal;

internal class AgentNamingService : IAgentNamingService
{
    private const int MaxNameLength = 60;

    private readonly IHttpClientFactory httpClientFactory;
    private readonly ILogger<AgentNamingService> logger;

    public AgentNamingService(IHttpClientFactory httpClientFactory, ILogger<AgentNamingService> logger)
    {
        this.httpClientFactory = httpClientFactory;
        this.logger = logger;
    }

    public async Task<string> GenerateNameAsync(
        IModelProvider provider,
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await CallLlmForNameAsync(provider, systemMessage, tools, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "LLM agent naming failed; falling back to heuristic name");
            return FallbackName(systemMessage, tools);
        }
    }

    private async Task<string> CallLlmForNameAsync(
        IModelProvider provider,
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        CancellationToken cancellationToken)
    {
        var systemText = string.Concat(systemMessage.Contents.Select(c => c.Text ?? ""));
        var toolNames = tools.Count > 0
            ? string.Join(", ", tools.Select(t => t.Name))
            : "(none)";

        var userPrompt = $"""
            Given the following AI agent definition, provide a short (2-5 words) human-readable name for it.
            Reply with only the name, no punctuation, no quotes, no explanation.

            System message:
            {Truncate(systemText, 800)}

            Tools: {toolNames}
            """;

        var requestBody = JsonSerializer.Serialize(new
        {
            model = "gpt-4o-mini",
            messages = new[]
            {
                new { role = "user", content = userPrompt }
            },
            max_tokens = 20,
            temperature = 0.3
        });

        var client = httpClientFactory.CreateClient("openai");
        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions")
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);

        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseBody);

        var name = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString()
            ?.Trim() ?? "";

        return string.IsNullOrWhiteSpace(name) ? FallbackName(systemMessage, tools) : Truncate(name, MaxNameLength);
    }

    private static string FallbackName(SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools)
    {
        var systemText = string.Concat(systemMessage.Contents.Select(c => c.Text ?? "")).Trim();

        if (!string.IsNullOrWhiteSpace(systemText))
        {
            return Truncate(systemText, MaxNameLength);
        }

        if (tools.Count > 0)
        {
            return Truncate($"Agent with {string.Join(", ", tools.Take(3).Select(t => t.Name))}", MaxNameLength);
        }

        return "Unnamed Agent";
    }

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength].TrimEnd();
}
