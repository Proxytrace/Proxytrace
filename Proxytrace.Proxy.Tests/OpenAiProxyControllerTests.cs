using System.Net;
using System.Text;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Application.Demo;
using Proxytrace.Domain.ApiKey;
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

        await controller.Proxy("chat/completions", CancellationToken.None);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [TestMethod]
    public async Task Proxy_BogusKey_ReturnsUnauthorized()
    {
        var controller = BuildController(Substitute.For<IIngestionStream>(), NoKeyResolver());
        controller.ControllerContext = BuildContext("Bearer not-a-real-key");

        await controller.Proxy("chat/completions", CancellationToken.None);

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

        await controller.Proxy("chat/completions", CancellationToken.None);

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

        await controller.Proxy("chat/completions", CancellationToken.None);

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

        await controller.Proxy("chat/completions", CancellationToken.None);

        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
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
        resolver.ResolveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((IApiKey?)null);
        return resolver;
    }

    private static IApiKeyResolver ResolverFor(IApiKey apiKey)
    {
        var resolver = Substitute.For<IApiKeyResolver>();
        resolver.ResolveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(apiKey);
        return resolver;
    }

    private static IApiKey ApiKey()
    {
        var provider = Substitute.For<IModelProvider>();
        provider.Id.Returns(Guid.NewGuid());
        provider.Name.Returns("test-provider");
        provider.ApiKey.Returns("sk-upstream");
        provider.Endpoint.Returns(new Uri("http://upstream.test/"));

        var project = Substitute.For<IProject>();
        project.Id.Returns(Guid.NewGuid());

        var apiKey = Substitute.For<IApiKey>();
        apiKey.Provider.Returns(provider);
        apiKey.Project.Returns(project);
        return apiKey;
    }

    private static ControllerContext BuildContext(string authHeader, string body = "{}")
    {
        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrEmpty(authHeader))
        {
            httpContext.Request.Headers.Authorization = authHeader;
        }

        httpContext.Request.ContentType = "application/json";
        httpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        httpContext.Request.Method = "POST";
        httpContext.Response.Body = new MemoryStream();
        return new ControllerContext { HttpContext = httpContext };
    }
}
