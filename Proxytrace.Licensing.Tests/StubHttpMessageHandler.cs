using System.Net;
using System.Text;

namespace Proxytrace.Licensing.Tests;

/// <summary>
/// Returns a preconfigured response (or throws) for any request, capturing the last request URI.
/// </summary>
internal sealed class StubHttpMessageHandler : HttpMessageHandler
{
    private readonly HttpStatusCode statusCode;
    private readonly string body;
    private readonly bool throwTransport;

    public StubHttpMessageHandler(HttpStatusCode statusCode, string body)
    {
        this.statusCode = statusCode;
        this.body = body;
    }

    private StubHttpMessageHandler(bool throwTransport)
    {
        this.throwTransport = throwTransport;
        this.body = string.Empty;
    }

    public static StubHttpMessageHandler Faulting() => new(throwTransport: true);

    public Uri? LastRequestUri { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        LastRequestUri = request.RequestUri;

        if (throwTransport)
            throw new HttpRequestException("simulated transport failure");

        return Task.FromResult(new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        });
    }
}
