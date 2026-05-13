using System.Net;
using System.Text;
using AwesomeAssertions;
using Autofac;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Trsr.Api.Controllers;
using Trsr.Application.Ingestion;
using Trsr.Domain;
using Trsr.Domain.ApiKey;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class OpenAiProxyControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Proxy_MissingAuthorization_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services, "{}");
        controller.ControllerContext = BuildContext("");

        await controller.Proxy("chat/completions", CancellationToken);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [TestMethod]
    public async Task Proxy_BogusKey_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services, "{}");
        controller.ControllerContext = BuildContext("Bearer not-a-real-key");

        await controller.Proxy("chat/completions", CancellationToken);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [TestMethod]
    public async Task Proxy_ValidKey_ForwardsToUpstream_AndEnqueuesIngestion()
    {
        var ingestor = Substitute.For<IAgentCallIngestor>();
        var responseJson = FakeHttpMessageHandler.BuildOpenAiResponse("hello");

        IServiceProvider services = GetServices(b =>
        {
            b.RegisterInstance(ingestor).As<IAgentCallIngestor>();
        });

        var apiKey = await SeedApiKeyAsync(services);
        var controller = ResolveController(services, responseJson);
        controller.ControllerContext = BuildContext($"Bearer {apiKey.ApiKey}", body: """{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}""");

        await controller.Proxy("chat/completions", CancellationToken);

        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
        await ingestor.Received(1).IngestInBackgroundAsync(
            Arg.Any<Domain.ModelProvider.IModelProvider>(),
            Arg.Any<IProject>(),
            Arg.Any<string>(),
            Arg.Any<string?>(),
            Arg.Any<TimeSpan>(),
            Arg.Any<HttpStatusCode>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Proxy_UpstreamThrows_Returns502()
    {
        IServiceProvider services = GetServices(b =>
        {
            b.Register(_ => new ThrowingHttpClientFactory()).As<IHttpClientFactory>();
        });
        var apiKey = await SeedApiKeyAsync(services);
        var controller = ResolveController(services, "{}");
        controller.ControllerContext = BuildContext($"Bearer {apiKey.ApiKey}", body: "{}");

        await controller.Proxy("chat/completions", CancellationToken);

        controller.Response.StatusCode.Should().Be(StatusCodes.Status502BadGateway);
    }

    [TestMethod]
    public async Task Proxy_IngestorThrowsSafely_DoesNotBreakResponse()
    {
        var ingestor = Substitute.For<IAgentCallIngestor>();
        ingestor.IngestInBackgroundAsync(
                Arg.Any<Domain.ModelProvider.IModelProvider>(),
                Arg.Any<IProject>(),
                Arg.Any<string>(),
                Arg.Any<string?>(),
                Arg.Any<TimeSpan>(),
                Arg.Any<HttpStatusCode>(),
                Arg.Any<string?>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromException(new InvalidOperationException("nope")));

        IServiceProvider services = GetServices(b => b.RegisterInstance(ingestor).As<IAgentCallIngestor>());
        var apiKey = await SeedApiKeyAsync(services);
        var controller = ResolveController(services, FakeHttpMessageHandler.BuildOpenAiResponse("ok"));
        controller.ControllerContext = BuildContext($"Bearer {apiKey.ApiKey}", body: "{}");

        await controller.Proxy("chat/completions", CancellationToken);

        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
    }

    private async Task<IApiKey> SeedApiKeyAsync(IServiceProvider services)
    {
        return await services.GetRequiredService<IDomainEntityGenerator<IApiKey>>().CreateAsync(CancellationToken);
    }

    private static OpenAiProxyController ResolveController(IServiceProvider services, string upstreamJson)
    {
        var httpClientFactory = services.GetService<IHttpClientFactory>()
            ?? new FakeHttpClientFactory(upstreamJson);
        return new OpenAiProxyController(
            httpClientFactory,
            services.GetRequiredService<IAgentCallIngestor>(),
            services.GetRequiredService<IApiKeyRepository>(),
            NullLogger<OpenAiProxyController>.Instance);
    }

    private static ControllerContext BuildContext(string authHeader, string body = "{}")
    {
        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrEmpty(authHeader))
            httpContext.Request.Headers.Authorization = authHeader;
        httpContext.Request.ContentType = "application/json";
        httpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        httpContext.Request.Method = "POST";
        httpContext.Response.Body = new MemoryStream();
        return new ControllerContext { HttpContext = httpContext };
    }

    private sealed class ThrowingHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
            => new(new ThrowingHandler()) { BaseAddress = new Uri("http://fake/") };
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => throw new HttpRequestException("network down");
    }
}
