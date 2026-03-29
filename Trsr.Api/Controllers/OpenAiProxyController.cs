using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Services;

namespace Trsr.Api.Controllers;

/// <summary>
/// Transparent reverse proxy for OpenAI-compatible APIs.
/// Clients point their <c>base_url</c> here instead of <c>https://api.openai.com</c>.
/// Every call is forwarded upstream, captured, and persisted as an <c>IAgentCall</c>.
/// </summary>
[ApiController]
[Route("openai")]
public class OpenAiProxyController : ControllerBase
{
    private static readonly HashSet<string> ForwardedRequestHeaders =
    [
        "authorization", "content-type", "openai-organization", "openai-project"
    ];

    private static readonly HashSet<string> ForwardedResponseHeaders =
    [
        "content-type", "openai-model", "openai-processing-ms", "openai-version",
        "x-request-id", "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests",
        "x-ratelimit-reset-requests"
    ];

    private readonly IHttpClientFactory httpClientFactory;
    private readonly IAgentCallIngestionService ingestionService;
    private readonly ILogger<OpenAiProxyController> logger;

    public OpenAiProxyController(
        IHttpClientFactory httpClientFactory,
        IAgentCallIngestionService ingestionService,
        ILogger<OpenAiProxyController> logger)
    {
        this.httpClientFactory = httpClientFactory;
        this.ingestionService = ingestionService;
        this.logger = logger;
    }

    [Route("v1/{**path}")]
    public async Task Proxy(string path, CancellationToken cancellationToken)
    {
        // Read request body up-front (we always need it for ingestion)
        using var requestBodyStream = new MemoryStream();
        await Request.Body.CopyToAsync(requestBodyStream, cancellationToken);
        var requestBodyBytes = requestBodyStream.ToArray();
        var requestBody = Encoding.UTF8.GetString(requestBodyBytes);

        var isStreaming = IsStreamingRequest(requestBody, Request.ContentType);

        var upstream = BuildUpstreamRequest(path, requestBodyBytes);
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
                Response.Headers[header.Key] = string.Join(", ", header.Value);
        }

        if (isStreaming)
        {
            await ProxyStreamingResponseAsync(path, requestBody, upstreamResponse, sw, cancellationToken);
        }
        else
        {
            await ProxyBufferedResponseAsync(path, requestBody, upstreamResponse, sw, cancellationToken);
        }
    }

    // ── Non-streaming ─────────────────────────────────────────────────────────

    private async Task ProxyBufferedResponseAsync(
        string path,
        string requestBody,
        HttpResponseMessage upstreamResponse,
        Stopwatch sw,
        CancellationToken cancellationToken)
    {
        var responseBody = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
        sw.Stop();

        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody), cancellationToken);

        _ = IngestSafeAsync(
            requestBody, 
            responseBody, 
            sw.Elapsed,
            upstreamResponse.StatusCode, 
            cancellationToken);
    }

    // ── Streaming (SSE) ───────────────────────────────────────────────────────

    private async Task ProxyStreamingResponseAsync(
        string path,
        string requestBody,
        HttpResponseMessage upstreamResponse,
        Stopwatch sw,
        CancellationToken cancellationToken)
    {
        var accumulated = new StringBuilder();

        await using var upstreamStream = await upstreamResponse.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(upstreamStream, Encoding.UTF8, leaveOpen: true);

        while (true)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null) break;

            accumulated.AppendLine(line);

            var lineBytes = Encoding.UTF8.GetBytes(line + "\n");
            await Response.Body.WriteAsync(lineBytes, cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        sw.Stop();

        // Store accumulated SSE content after streaming is complete
        _ = IngestSafeAsync(requestBody, accumulated.ToString(), sw.Elapsed,
            upstreamResponse.StatusCode, cancellationToken);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task IngestSafeAsync(
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken)
    {
        try
        {
            await ingestionService.IngestAsync(
                provider: "openai",
                requestBody: requestBody,
                responseBody: responseBody,
                duration: duration,
                httpStatus: httpStatus,
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Ingestion failed after proxy call");
        }
    }

    private HttpRequestMessage BuildUpstreamRequest(string path, byte[] bodyBytes)
    {
        var upstreamRequest = new HttpRequestMessage
        {
            Method = new HttpMethod(Request.Method),
            RequestUri = new Uri($"v1/{path}{Request.QueryString}", UriKind.Relative),
            Content = new ByteArrayContent(bodyBytes),
        };

        foreach (var header in Request.Headers)
        {
            if (!ForwardedRequestHeaders.Contains(header.Key.ToLowerInvariant())) continue;

            if (header.Key.Equals("content-type", StringComparison.OrdinalIgnoreCase))
                upstreamRequest.Content.Headers.ContentType =
                    MediaTypeHeaderValue.Parse(header.Value.ToString());
            else
                upstreamRequest.Headers.TryAddWithoutValidation(header.Key, (IEnumerable<string?>)header.Value);
        }

        return upstreamRequest;
    }

    private static bool IsStreamingRequest(string requestBody, string? contentType)
    {
        if (!string.IsNullOrEmpty(contentType) &&
            contentType.Contains("text/event-stream", StringComparison.OrdinalIgnoreCase))
            return true;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(requestBody);
            if (doc.RootElement.TryGetProperty("stream", out var stream))
                return stream.ValueKind == System.Text.Json.JsonValueKind.True;
        }
        catch { /* not JSON or no stream field */ }

        return false;
    }
}
