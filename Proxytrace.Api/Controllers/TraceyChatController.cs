using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Tracey;
using Proxytrace.Domain;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Messaging;

namespace Proxytrace.Api.Controllers;

/// <summary>
/// Same-origin OpenAI-compatible passthrough for the Tracey assistant. The browser AI runtime calls
/// this (via the app's own origin + JWT, so no CORS and no short-lived key); it forwards each call to
/// the project's provider with the real upstream key, streams the response back, and publishes the
/// captured exchange to the ingestion stream so Tracey's calls are persisted as AgentCalls — exactly
/// like <c>Proxytrace.Proxy</c>, but in-process and authenticated by the user's session.
/// </summary>
[ApiController]
[Authorize]
public class TraceyChatController : ControllerBase
{
    private static readonly IReadOnlyCollection<string> ForwardedResponseHeaders = new HashSet<string>(
    [
        "content-type",
        "openai-model",
        "openai-processing-ms",
        "openai-version",
        "x-request-id",
    ]);

    private readonly IHttpClientFactory httpClientFactory;
    private readonly IIngestionStream stream;
    private readonly IRepository<IProject> projects;
    private readonly ITraceyAgentProvisioner traceyProvisioner;
    private readonly ICurrentUserAccessor currentUser;
    private readonly ILogger<TraceyChatController> logger;

    public TraceyChatController(
        IHttpClientFactory httpClientFactory,
        IIngestionStream stream,
        IRepository<IProject> projects,
        ITraceyAgentProvisioner traceyProvisioner,
        ICurrentUserAccessor currentUser,
        ILogger<TraceyChatController> logger)
    {
        this.httpClientFactory = httpClientFactory;
        this.stream = stream;
        this.projects = projects;
        this.traceyProvisioner = traceyProvisioner;
        this.currentUser = currentUser;
        this.logger = logger;
    }

    [Route("api/tracey/{projectId:guid}/openai/v1/{**path}")]
    [HttpPost]
    public async Task Forward(Guid projectId, string path, CancellationToken cancellationToken)
    {
        IProject? project = await projects.FindAsync(projectId, cancellationToken);
        if (project is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        // Authorization: forwarding spends the project provider's real upstream credential, so the
        // caller must belong to the project (admins may reach any project). Without this, any
        // authenticated user could drive any tenant's key by guessing a project id.
        var user = await currentUser.GetCurrentUserAsync(cancellationToken);
        if (user is null || !IsMember(user, project))
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var provider = project.SystemEndpoint.Provider;

        // Guarantee Tracey's system agent exists and tag the captured call with its name, so
        // ingestion attributes it directly instead of fingerprint-matching her prompt/tools.
        var traceyAgent = await traceyProvisioner.EnsureTraceyAgentAsync(project, cancellationToken);

        using var bodyStream = new MemoryStream();
        await Request.Body.CopyToAsync(bodyStream, cancellationToken);
        var requestBodyBytes = bodyStream.ToArray();

        var isStreaming = IsStreamingRequest(requestBodyBytes);
        if (isStreaming)
        {
            requestBodyBytes = InjectStreamUsageOption(requestBodyBytes);
        }

        // Decode once, after the optional stream-usage injection, for the ingest payload.
        var requestBody = Encoding.UTF8.GetString(requestBodyBytes);

        var upstream = BuildUpstreamRequest(path, requestBodyBytes, provider.ApiKey, provider.Endpoint);
        var client = httpClientFactory.CreateClient("tracey-upstream");
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
            logger.LogWarning(ex, "Tracey upstream request to /v1/{Path} failed", path);
            Response.StatusCode = StatusCodes.Status502BadGateway;
            return;
        }

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
            await StreamResponseAsync(provider.Id, project.Id, traceyAgent.Name, requestBody, upstreamResponse, sw, cancellationToken);
        }
        else
        {
            await BufferedResponseAsync(provider.Id, project.Id, traceyAgent.Name, requestBody, upstreamResponse, sw, cancellationToken);
        }
    }

    private async Task BufferedResponseAsync(
        Guid providerId,
        Guid projectId,
        string agentName,
        string requestBody,
        HttpResponseMessage upstreamResponse,
        Stopwatch sw,
        CancellationToken cancellationToken)
    {
        var responseBody = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
        sw.Stop();
        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody), cancellationToken);
        await EnqueueSafeAsync(providerId, projectId, agentName, requestBody, responseBody, sw.Elapsed, upstreamResponse.StatusCode, cancellationToken);
    }

    private async Task StreamResponseAsync(
        Guid providerId,
        Guid projectId,
        string agentName,
        string requestBody,
        HttpResponseMessage upstreamResponse,
        Stopwatch sw,
        CancellationToken cancellationToken)
    {
        // SSE must not be buffered: disable response buffering so each flushed chunk reaches the
        // browser immediately, even behind a reverse proxy.
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

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
            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(line + "\n"), cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        sw.Stop();
        await EnqueueSafeAsync(providerId, projectId, agentName, requestBody, accumulated.ToString(), sw.Elapsed, upstreamResponse.StatusCode, cancellationToken);
    }

    private async Task EnqueueSafeAsync(
        Guid providerId,
        Guid projectId,
        string agentName,
        string requestBody,
        string responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken)
    {
        try
        {
            await stream.PublishAsync(
                new IngestMessage(
                    ProviderId: providerId,
                    ProjectId: projectId,
                    RequestBody: requestBody,
                    ResponseBody: responseBody,
                    DurationMs: (long)duration.TotalMilliseconds,
                    HttpStatus: (int)httpStatus,
                    SessionId: null,
                    AgentName: agentName),
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish Tracey ingestion message");
        }
    }

    private HttpRequestMessage BuildUpstreamRequest(string path, byte[] bodyBytes, string providerApiKey, Uri providerEndpoint)
    {
        var baseUrl = providerEndpoint.ToString().TrimEnd('/');
        var request = new HttpRequestMessage
        {
            Method = HttpMethod.Post,
            RequestUri = new Uri($"{baseUrl}/{path}{Request.QueryString}"),
            Content = new ByteArrayContent(bodyBytes),
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {providerApiKey}");
        return request;
    }

    private static byte[] InjectStreamUsageOption(byte[] bodyBytes)
    {
        try
        {
            using var doc = JsonDocument.Parse(bodyBytes);
            if (doc.RootElement.TryGetProperty("stream_options", out _))
            {
                return bodyBytes;
            }

            using var ms = new MemoryStream();
            using var writer = new Utf8JsonWriter(ms);
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

    private static bool IsStreamingRequest(byte[] requestBodyBytes)
    {
        try
        {
            using var doc = JsonDocument.Parse(requestBodyBytes);
            if (doc.RootElement.TryGetProperty("stream", out var streamProp))
            {
                return streamProp.ValueKind == JsonValueKind.True;
            }
        }
        catch
        {
            // not JSON / no stream field
        }

        return false;
    }

    private static bool IsMember(IUser user, IProject project)
        => user.Role == UserRole.Admin || project.Members.Any(m => m.Id == user.Id);
}
