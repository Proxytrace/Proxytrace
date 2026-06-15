using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Application.Demo;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Messaging;

namespace Proxytrace.Proxy.Controllers;

/// <summary>
/// Transparent reverse proxy for OpenAI-compatible APIs, hosted in the standalone ingestion proxy
/// service. Authenticates the Proxytrace API key, forwards every call upstream, streams the
/// response back to the client, then publishes the captured call to the ingestion stream for the
/// main app to persist. Stays up independently of the rest of the backend.
/// </summary>
[ApiController]
public class OpenAiProxyController : ControllerBase
{
    private const string SessionIdHeader = "x-proxytrace-session-id";

    // Optional: a client may name its owning agent explicitly. When present, ingestion attributes the
    // call to that named agent directly, skipping the prompt/tool similarity matcher.
    private const string AgentNameHeader = "x-proxytrace-agent";

    private static readonly IReadOnlyCollection<string> ForwardedRequestHeaders = new HashSet<string>(
    [
        "authorization",
        "content-type",
        "openai-organization",
        "openai-project"
    ]);

    private static readonly IReadOnlyCollection<string> ForwardedResponseHeaders = new HashSet<string>(
    [
        "content-type",
        "openai-model",
        "openai-processing-ms",
        "openai-version",
        "x-request-id",
        "x-ratelimit-limit-requests",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-reset-requests"
    ]);

    private readonly IHttpClientFactory httpClientFactory;
    private readonly IIngestionStream stream;
    private readonly IApiKeyResolver apiKeyResolver;
    private readonly KioskOptions kioskOptions;
    private readonly ILogger<OpenAiProxyController> logger;

    public OpenAiProxyController(
        IHttpClientFactory httpClientFactory,
        IIngestionStream stream,
        IApiKeyResolver apiKeyResolver,
        KioskOptions kioskOptions,
        ILogger<OpenAiProxyController> logger)
    {
        this.httpClientFactory = httpClientFactory;
        this.stream = stream;
        this.apiKeyResolver = apiKeyResolver;
        this.kioskOptions = kioskOptions;
        this.logger = logger;
    }

    // Two shapes are accepted: the project-scoped `/{project}/openai/v1/…` form (required for the
    // upstream-provider-key auth path) and the legacy `/openai/v1/…` form (project derived from a
    // Proxytrace-issued key). The literal `openai/v1/…` template is matched ahead of the
    // parameterised one, so `project` is only bound for the scoped form.
    [Route("openai/v1/{**path}")]
    [Route("{project}/openai/v1/{**path}")]
    [HttpGet, HttpPost, HttpPut, HttpDelete, HttpPatch, HttpHead, HttpOptions]
    public async Task Proxy(string path, string? project, CancellationToken cancellationToken)
    {
        if (kioskOptions.Enabled)
        {
            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            Response.ContentType = "application/json";
            await Response.WriteAsync(
                "{\"kiosk\":true,\"message\":\"Proxy disabled in demo mode.\"}",
                cancellationToken);
            return;
        }

        ResolvedApiKey? resolved = await GetResolvedKeyAsync(project, cancellationToken);
        if (resolved is null)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        // Azure has no OpenAI-style /models route that lists usable models — its deployments live at
        // /openai/deployments?api-version=…, so a blind passthrough returns an empty list. Translate
        // GET /models to that deployments listing and reshape it to an OpenAI model list.
        if (HttpMethods.IsGet(Request.Method)
            && IsModelsPath(path)
            && ProviderEndpoints.IsAzure(resolved.Provider.Endpoint))
        {
            await ServeAzureModelsAsync(resolved.Provider, cancellationToken);
            return;
        }

        // Read request body up-front (we always need it for ingestion)
        using var requestBodyStream = new MemoryStream();
        await Request.Body.CopyToAsync(requestBodyStream, cancellationToken);
        var requestBodyBytes = requestBodyStream.ToArray();
        var requestBody = Encoding.UTF8.GetString(requestBodyBytes);

        var sessionId = Request.Headers.TryGetValue(SessionIdHeader, out var sid)
            ? sid.ToString()
            : null;

        var agentName = Request.Headers.TryGetValue(AgentNameHeader, out var an)
            ? an.ToString()
            : null;

        var isStreaming = IsStreamingRequest(requestBody, Request.ContentType);

        if (isStreaming)
        {
            requestBodyBytes = InjectStreamUsageOption(requestBodyBytes);
            requestBody = Encoding.UTF8.GetString(requestBodyBytes);
        }

        var upstream = BuildUpstreamRequest(path, requestBodyBytes, resolved.Provider.ApiKey, resolved.Provider.Endpoint);
        var client = httpClientFactory.CreateClient("openai");
        var sw = Stopwatch.StartNew();

        HttpResponseMessage upstreamResponse;
        try
        {
            var completionOption = isStreaming
                ? HttpCompletionOption.ResponseHeadersRead
                : HttpCompletionOption.ResponseContentRead;

            upstreamResponse = await client.SendAsync(upstream, completionOption, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Upstream request to /v1/{Path} failed", path);
            Response.StatusCode = StatusCodes.Status502BadGateway;
            return;
        }

        // Copy upstream status + safe response headers to our response
        Response.StatusCode = (int)upstreamResponse.StatusCode;
        foreach (var header in upstreamResponse.Headers.Concat(upstreamResponse.Content.Headers))
        {
            if (ForwardedResponseHeaders.Contains(header.Key.ToLowerInvariant()))
            {
                Response.Headers[header.Key] = string.Join(", ", header.Value);
            }
        }

        if (isStreaming)
        {
            await ProxyStreamingResponseAsync(resolved.Provider, resolved.Project, requestBody, upstreamResponse, sw, sessionId, agentName, cancellationToken);
        }
        else
        {
            await ProxyBufferedResponseAsync(resolved.Provider, resolved.Project, requestBody, upstreamResponse, sw, sessionId, agentName, cancellationToken);
        }
    }

    // ── Azure /models translation ───────────────────────────────────────────────

    private static bool IsModelsPath(string path) =>
        path.Trim('/').Equals("models", StringComparison.OrdinalIgnoreCase);

    private async Task ServeAzureModelsAsync(IModelProvider provider, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient("openai");
        using var request = new HttpRequestMessage(HttpMethod.Get, ProviderEndpoints.AzureDeploymentsUri(provider.Endpoint));
        request.Headers.Add("api-key", provider.ApiKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);

        HttpResponseMessage upstreamResponse;
        try
        {
            upstreamResponse = await client.SendAsync(request, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure deployments lookup for /models failed");
            Response.StatusCode = StatusCodes.Status502BadGateway;
            return;
        }

        var body = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
        Response.StatusCode = (int)upstreamResponse.StatusCode;
        Response.ContentType = "application/json";

        if (!upstreamResponse.IsSuccessStatusCode)
        {
            // Surface Azure's own error verbatim.
            await Response.WriteAsync(body, cancellationToken);
            return;
        }

        await Response.WriteAsync(AzureDeploymentsToModelList(body), cancellationToken);
    }

    // Reshape Azure's deployments response ({ "data": [ { "id", "model" } ] }) into an OpenAI
    // model list ({ "object": "list", "data": [ { "id", "object": "model" } ] }). Falls back to the
    // raw upstream body if it is not the expected JSON shape.
    private static string AzureDeploymentsToModelList(string deploymentsJson)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(deploymentsJson);
            using var ms = new MemoryStream();
            using var writer = new System.Text.Json.Utf8JsonWriter(ms);
            writer.WriteStartObject();
            writer.WriteString("object", "list");
            writer.WritePropertyName("data");
            writer.WriteStartArray();
            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var id = item.TryGetProperty("id", out var idEl) &&
                             idEl.ValueKind == System.Text.Json.JsonValueKind.String
                        ? idEl.GetString()
                        : null;
                    if (string.IsNullOrWhiteSpace(id))
                    {
                        continue;
                    }

                    writer.WriteStartObject();
                    writer.WriteString("id", id);
                    writer.WriteString("object", "model");
                    writer.WriteEndObject();
                }
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
            writer.Flush();
            return Encoding.UTF8.GetString(ms.ToArray());
        }
        catch
        {
            return deploymentsJson;
        }
    }

    private async Task<ResolvedApiKey?> GetResolvedKeyAsync(string? projectSlug, CancellationToken cancellationToken)
    {
        var authHeader = Request.Headers.Authorization.ToString();
        var rawKey = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader["Bearer ".Length..].Trim()
            : null;

        if (string.IsNullOrEmpty(rawKey))
        {
            return null;
        }

        return await apiKeyResolver.ResolveAsync(rawKey, projectSlug, cancellationToken);
    }

    // ── Non-streaming ─────────────────────────────────────────────────────────

    private async Task ProxyBufferedResponseAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        HttpResponseMessage upstreamResponse,
        Stopwatch sw,
        string? sessionId,
        string? agentName,
        CancellationToken cancellationToken)
    {
        var responseBody = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
        sw.Stop();

        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody), cancellationToken);

        await EnqueueSafeAsync(provider, project, requestBody, responseBody, sw.Elapsed, upstreamResponse.StatusCode, sessionId, agentName, cancellationToken);
    }

    // ── Streaming (SSE) ───────────────────────────────────────────────────────

    private async Task ProxyStreamingResponseAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        HttpResponseMessage upstreamResponse,
        Stopwatch sw,
        string? sessionId,
        string? agentName,
        CancellationToken cancellationToken)
    {
        var accumulated = new StringBuilder();

        await using var upstreamStream = await upstreamResponse.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(upstreamStream, Encoding.UTF8, leaveOpen: true);

        while (true)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null)
            {
                break;
            }

            accumulated.AppendLine(line);

            var lineBytes = Encoding.UTF8.GetBytes(line + "\n");
            await Response.Body.WriteAsync(lineBytes, cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        sw.Stop();

        await EnqueueSafeAsync(provider, project, requestBody, accumulated.ToString(), sw.Elapsed, upstreamResponse.StatusCode, sessionId, agentName, cancellationToken);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task EnqueueSafeAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? sessionId,
        string? agentName,
        CancellationToken cancellationToken)
    {
        try
        {
            await stream.PublishAsync(
                new IngestMessage(
                    ProviderId: provider.Id,
                    ProjectId: project.Id,
                    RequestBody: requestBody,
                    ResponseBody: responseBody,
                    DurationMs: (long)duration.TotalMilliseconds,
                    HttpStatus: (int)httpStatus,
                    SessionId: sessionId,
                    AgentName: agentName),
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish ingestion message after proxy call");
        }
    }

    private HttpRequestMessage BuildUpstreamRequest(string path, byte[] bodyBytes, string providerApiKey, Uri providerEndpoint)
    {
        var baseUrl = providerEndpoint.ToString().TrimEnd('/');
        var upstreamRequest = new HttpRequestMessage
        {
            Method = new HttpMethod(Request.Method),
            RequestUri = new Uri($"{baseUrl}/{path}{Request.QueryString}"),
            // Only carry a body when there is one — attaching empty content to a bodyless verb
            // (GET /models, DELETE, …) makes strict upstreams reject the request.
            Content = bodyBytes.Length > 0 ? new ByteArrayContent(bodyBytes) : null,
        };

        foreach (var header in Request.Headers)
        {
            if (!ForwardedRequestHeaders.Contains(header.Key.ToLowerInvariant()))
            {
                continue;
            }

            if (header.Key.Equals("content-type", StringComparison.OrdinalIgnoreCase))
            {
                if (upstreamRequest.Content is not null)
                {
                    upstreamRequest.Content.Headers.ContentType =
                        MediaTypeHeaderValue.Parse(header.Value.ToString());
                }
            }
            else if (header.Key.Equals("authorization", StringComparison.OrdinalIgnoreCase))
            {
                // Replace the Proxytrace API key with the model provider's actual API key
                upstreamRequest.Headers.TryAddWithoutValidation("Authorization", $"Bearer {providerApiKey}");
            }
            else
            {
                upstreamRequest.Headers.TryAddWithoutValidation(header.Key, (IEnumerable<string?>)header.Value);
            }
        }

        return upstreamRequest;
    }

    private static byte[] InjectStreamUsageOption(byte[] bodyBytes)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(bodyBytes);
            if (doc.RootElement.TryGetProperty("stream_options", out _))
            {
                return bodyBytes;
            }

            using var ms = new MemoryStream();
            using var writer = new System.Text.Json.Utf8JsonWriter(ms);
            writer.WriteStartObject();
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                prop.WriteTo(writer);
            }
            writer.WritePropertyName("stream_options");
            writer.WriteStartObject();
            writer.WriteBoolean("include_usage", true);
            writer.WriteEndObject();
            writer.WriteEndObject();
            writer.Flush();
            return ms.ToArray();
        }
        catch
        {
            return bodyBytes;
        }
    }

    private static bool IsStreamingRequest(string requestBody, string? contentType)
    {
        if (!string.IsNullOrEmpty(contentType) &&
            contentType.Contains("text/event-stream", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(requestBody);
            if (doc.RootElement.TryGetProperty("stream", out var stream))
            {
                return stream.ValueKind == System.Text.Json.JsonValueKind.True;
            }
        }
        catch { /* not JSON or no stream field */ }

        return false;
    }
}
