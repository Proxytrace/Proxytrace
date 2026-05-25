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
