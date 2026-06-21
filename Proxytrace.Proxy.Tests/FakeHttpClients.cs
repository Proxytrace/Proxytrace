using System.Net;
using System.Text;

namespace Proxytrace.Proxy.Tests;

/// <summary>Returns a fixed response body for every request.</summary>
internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly string responseBody;
    private readonly HttpStatusCode statusCode;

    public FakeHttpMessageHandler(string responseBody, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        this.responseBody = responseBody;
        this.statusCode = statusCode;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
        => Task.FromResult(new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json"),
        });

    public static string BuildOpenAiResponse(string assistantText)
    {
        var encoded = System.Text.Json.JsonSerializer.Serialize(assistantText);
        return
            "{\"id\":\"chatcmpl-test\",\"object\":\"chat.completion\",\"model\":\"gpt-4o\"," +
            "\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":" +
            encoded +
            "},\"finish_reason\":\"stop\"}]," +
            "\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5,\"total_tokens\":15}}";
    }
}

internal sealed class FakeHttpClientFactory : IHttpClientFactory
{
    private readonly HttpClient client;

    public FakeHttpClientFactory(string responseBody)
        => client = new HttpClient(new FakeHttpMessageHandler(responseBody))
        {
            BaseAddress = new Uri("http://fake-upstream/"),
        };

    public HttpClient CreateClient(string name) => client;
}

internal sealed class ThrowingHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(new ThrowingHandler())
    {
        BaseAddress = new Uri("http://fake-upstream/"),
    };

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => throw new HttpRequestException("network down");
    }
}

/// <summary>Records the request the proxy forwarded upstream so tests can assert on it.</summary>
internal sealed class CapturingHttpMessageHandler : HttpMessageHandler
{
    private readonly string responseBody;

    public CapturingHttpMessageHandler(string responseBody = "{}") => this.responseBody = responseBody;

    public HttpMethod? LastMethod { get; private set; }
    public bool LastHadContent { get; private set; }
    public byte[] LastBody { get; private set; } = [];
    public string? LastContentType { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        LastMethod = request.Method;
        LastHadContent = request.Content is not null;
        if (request.Content is not null)
        {
            LastBody = await request.Content.ReadAsByteArrayAsync(cancellationToken);
            LastContentType = request.Content.Headers.TryGetValues("Content-Type", out var values)
                ? string.Join(",", values)
                : null;
        }

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json"),
        };
    }
}

internal sealed class SingleHandlerClientFactory : IHttpClientFactory
{
    private readonly HttpMessageHandler handler;
    public SingleHandlerClientFactory(HttpMessageHandler handler) => this.handler = handler;
    public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
}
