using System.Net;
using System.Text;

namespace Proxytrace.Api.Tests;

/// <summary>
/// A fake HTTP message handler that returns a preconfigured response body for all requests.
/// </summary>
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
    {
        var response = new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
        };
        return Task.FromResult(response);
    }

    /// <summary>
    /// Builds a valid OpenAI chat completion response JSON with the given assistant text.
    /// </summary>
    public static string BuildOpenAiResponse(string assistantText)
    {
        // Use JsonSerializer to safely encode the assistant text into the JSON payload.
        var encoded = System.Text.Json.JsonSerializer.Serialize(assistantText);
        return
            "{\"id\":\"chatcmpl-test\",\"object\":\"chat.completion\",\"model\":\"gpt-4o\"," +
            "\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":" +
            encoded +
            "},\"finish_reason\":\"stop\"}]," +
            "\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5,\"total_tokens\":15}}";
    }
}

/// <summary>
/// A simple IHttpClientFactory implementation that wraps a single pre-configured HttpClient.
/// </summary>
internal sealed class FakeHttpClientFactory : IHttpClientFactory
{
    private readonly HttpClient client;

    public FakeHttpClientFactory(string responseBody)
    {
        client = new HttpClient(new FakeHttpMessageHandler(responseBody))
        {
            BaseAddress = new Uri("http://fake-agent/")
        };
    }

    public HttpClient CreateClient(string name) => client;
}
