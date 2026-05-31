using System.Text;
using Autofac;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Domain;
using Proxytrace.Domain.Project;
using Proxytrace.Messaging;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class TraceyChatControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Forward_WritesUpstreamResponse_AndPublishesIngestion()
    {
        var upstreamBody = FakeHttpMessageHandler.BuildOpenAiResponse("Hello from Tracey");
        var ingestion = Substitute.For<IIngestionStream>();

        IServiceProvider services = GetServices(builder =>
        {
            builder.Register(_ => new FakeHttpClientFactory(upstreamBody))
                .As<IHttpClientFactory>().SingleInstance();
            builder.RegisterInstance(ingestion).As<IIngestionStream>();
        });

        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>()
            .CreateAsync(CancellationToken);

        var responseBody = await InvokeForwardAsync(
            services, project.Id, """{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}""");

        responseBody.Should().Be(upstreamBody);
        await ingestion.Received(1).PublishAsync(
            Arg.Is<IngestMessage>(m =>
                m.ProjectId == project.Id
                && m.ProviderId == project.SystemEndpoint.Provider.Id
                && m.HttpStatus == 200),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Forward_UnknownProject_Returns404()
    {
        IServiceProvider services = GetServices(builder =>
            builder.RegisterInstance(Substitute.For<IIngestionStream>()).As<IIngestionStream>());

        var controller = new TraceyChatController(
            services.GetRequiredService<IHttpClientFactory>(),
            services.GetRequiredService<IIngestionStream>(),
            services.GetRequiredService<IRepository<IProject>>(),
            NullLogger<TraceyChatController>.Instance);

        var http = new DefaultHttpContext();
        http.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        http.Response.Body = new MemoryStream();
        controller.ControllerContext = new ControllerContext { HttpContext = http };

        await controller.Forward(Guid.NewGuid(), "chat/completions", CancellationToken);

        http.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    private async Task<string> InvokeForwardAsync(IServiceProvider services, Guid projectId, string requestJson)
    {
        var controller = new TraceyChatController(
            services.GetRequiredService<IHttpClientFactory>(),
            services.GetRequiredService<IIngestionStream>(),
            services.GetRequiredService<IRepository<IProject>>(),
            NullLogger<TraceyChatController>.Instance);

        var http = new DefaultHttpContext();
        http.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(requestJson));
        http.Request.ContentType = "application/json";
        var responseStream = new MemoryStream();
        http.Response.Body = responseStream;
        controller.ControllerContext = new ControllerContext { HttpContext = http };

        await controller.Forward(projectId, "chat/completions", CancellationToken);

        return Encoding.UTF8.GetString(responseStream.ToArray());
    }
}
