using System.Net;
using System.Text;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Application.Demo;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Messaging;
using Proxytrace.Proxy.Controllers;

namespace Proxytrace.Proxy.Tests;

[TestClass]
public sealed class OpenAiProxyControllerTests
{
    [TestMethod]
    public async Task Proxy_MissingAuthorization_ReturnsUnauthorized()
    {
        var controller = BuildController(Substitute.For<IIngestionStream>(), NoKeyResolver());
        controller.ControllerContext = BuildContext(authHeader: "");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [TestMethod]
    public async Task Proxy_BogusKey_ReturnsUnauthorized()
    {
        var controller = BuildController(Substitute.For<IIngestionStream>(), NoKeyResolver());
        controller.ControllerContext = BuildContext("Bearer not-a-real-key");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [TestMethod]
    public async Task Proxy_ValidKey_ForwardsUpstream_AndPublishesIngestion()
    {
        var stream = Substitute.For<IIngestionStream>();
        var controller = BuildController(
            stream,
            ResolverFor(ApiKey()),
            new FakeHttpClientFactory(FakeHttpMessageHandler.BuildOpenAiResponse("hello")));
        controller.ControllerContext = BuildContext(
            "Bearer valid",
            body: """{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}""");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
        await stream.Received(1).PublishAsync(Arg.Any<IngestMessage>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Proxy_UpstreamThrows_Returns502()
    {
        var controller = BuildController(
            Substitute.For<IIngestionStream>(),
            ResolverFor(ApiKey()),
            new ThrowingHttpClientFactory());
        controller.ControllerContext = BuildContext("Bearer valid", body: "{}");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status502BadGateway);
    }

    [TestMethod]
    public async Task Proxy_PublishThrows_DoesNotBreakResponse()
    {
        var stream = Substitute.For<IIngestionStream>();
        stream.PublishAsync(Arg.Any<IngestMessage>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromException(new InvalidOperationException("redis down")));

        var controller = BuildController(
            stream,
            ResolverFor(ApiKey()),
            new FakeHttpClientFactory(FakeHttpMessageHandler.BuildOpenAiResponse("ok")));
        controller.ControllerContext = BuildContext("Bearer valid", body: "{}");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task Proxy_GetWithoutBody_DoesNotForwardARequestBody()
    {
        var capture = new CapturingHttpMessageHandler("""{"object":"list","data":[]}""");
        var controller = BuildController(
            Substitute.For<IIngestionStream>(),
            ResolverFor(ApiKey()),
            new SingleHandlerClientFactory(capture));
        controller.ControllerContext = BuildContext("Bearer valid", body: "", method: "GET");

        await controller.Proxy("models", project: null, CancellationToken.None);

        capture.LastMethod.Should().Be(HttpMethod.Get);
        capture.LastHadContent.Should().BeFalse("a bodyless GET must not be forwarded with a request body");
    }

    [TestMethod]
    public async Task Proxy_PostWithBody_ForwardsBodyUpstream()
    {
        var capture = new CapturingHttpMessageHandler(FakeHttpMessageHandler.BuildOpenAiResponse("ok"));
        var controller = BuildController(
            Substitute.For<IIngestionStream>(),
            ResolverFor(ApiKey()),
            new SingleHandlerClientFactory(capture));
        controller.ControllerContext = BuildContext("Bearer valid", body: """{"model":"gpt-4o","messages":[]}""");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        capture.LastHadContent.Should().BeTrue();
        Encoding.UTF8.GetString(capture.LastBody).Should().Be("""{"model":"gpt-4o","messages":[]}""");
    }

    [TestMethod]
    public async Task Proxy_MalformedContentType_DoesNotCrash_AndForwardsHeader()
    {
        var capture = new CapturingHttpMessageHandler(FakeHttpMessageHandler.BuildOpenAiResponse("ok"));
        var controller = BuildController(
            Substitute.For<IIngestionStream>(),
            ResolverFor(ApiKey()),
            new SingleHandlerClientFactory(capture));
        controller.ControllerContext = BuildContext(
            "Bearer valid",
            body: """{"model":"gpt-4o","messages":[]}""",
            contentType: "garbage;;");

        await controller.Proxy("chat/completions", project: null, CancellationToken.None);

        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
        capture.LastContentType.Should().Be("garbage;;", "an unparseable Content-Type is forwarded raw, not dropped or fatal");
    }

    private static OpenAiProxyController BuildController(
        IIngestionStream stream,
        IApiKeyResolver resolver,
        IHttpClientFactory? httpClientFactory = null)
        => new(
            httpClientFactory ?? new FakeHttpClientFactory("{}"),
            stream,
            resolver,
            new KioskOptions(),
            NullLogger<OpenAiProxyController>.Instance);

    private static IApiKeyResolver NoKeyResolver()
    {
        var resolver = Substitute.For<IApiKeyResolver>();
        resolver.ResolveAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns((ResolvedApiKey?)null);
        return resolver;
    }

    private static IApiKeyResolver ResolverFor(ResolvedApiKey resolved)
    {
        var resolver = Substitute.For<IApiKeyResolver>();
        resolver.ResolveAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns(resolved);
        return resolver;
    }

    private static ResolvedApiKey ApiKey()
    {
        var provider = Substitute.For<IModelProvider>();
        provider.Id.Returns(Guid.NewGuid());
        provider.Name.Returns("test-provider");
        provider.ApiKey.Returns("sk-upstream");
        provider.Endpoint.Returns(new Uri("http://upstream.test/"));

        var project = Substitute.For<IProject>();
        project.Id.Returns(Guid.NewGuid());

        return new ResolvedApiKey(project, provider);
    }

    private static ControllerContext BuildContext(
        string authHeader, string body = "{}", string method = "POST", string contentType = "application/json")
    {
        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrEmpty(authHeader))
        {
            httpContext.Request.Headers.Authorization = authHeader;
        }

        if (!string.IsNullOrEmpty(body))
        {
            httpContext.Request.ContentType = contentType;
        }

        httpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        httpContext.Request.Method = method;
        httpContext.Response.Body = new MemoryStream();
        return new ControllerContext { HttpContext = httpContext };
    }
}
