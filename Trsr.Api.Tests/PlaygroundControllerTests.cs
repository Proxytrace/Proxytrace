using AwesomeAssertions;
using Autofac;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.Playground;
using Trsr.Application.Playground;
using Trsr.Application.Playground.Internal;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class PlaygroundControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Complete_NotImplemented_WritesErrorEvent()
    {
        var service = Substitute.For<IPlaygroundService>();
        service.CompleteStreamAsync(Arg.Any<PlaygroundCompleteRequest>(), Arg.Any<CancellationToken>())
            .Returns(_ => ThrowNotImplementedAsync());

        IServiceProvider services = GetServices(b => b.RegisterInstance(service).As<IPlaygroundService>());
        var controller = new PlaygroundController(services.GetRequiredService<IPlaygroundService>());
        var httpContext = new DefaultHttpContext();
        var body = new MemoryStream();
        httpContext.Response.Body = body;
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        await controller.Complete(BuildRequest(), CancellationToken);

        body.Position = 0;
        var text = new StreamReader(body).ReadToEnd();
        text.Should().Contain("event: error");
        text.Should().Contain("not implemented");
    }

    [TestMethod]
    public async Task Complete_UnexpectedException_WritesErrorEvent()
    {
        var service = Substitute.For<IPlaygroundService>();
        service.CompleteStreamAsync(Arg.Any<PlaygroundCompleteRequest>(), Arg.Any<CancellationToken>())
            .Returns(_ => ThrowAsync(new InvalidOperationException("boom")));

        IServiceProvider services = GetServices(b => b.RegisterInstance(service).As<IPlaygroundService>());
        var controller = new PlaygroundController(services.GetRequiredService<IPlaygroundService>());
        var httpContext = new DefaultHttpContext();
        var body = new MemoryStream();
        httpContext.Response.Body = body;
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        await controller.Complete(BuildRequest(), CancellationToken);

        body.Position = 0;
        var text = new StreamReader(body).ReadToEnd();
        text.Should().Contain("event: error");
        text.Should().Contain("boom");
    }

    private static PlaygroundCompleteRequestDto BuildRequest() => new(
        Guid.NewGuid(), Guid.NewGuid(),
        "system",
        new PlaygroundModelParametersDto(null, null, null, null, null, null, null, null, null),
        [],
        []);

    private static async IAsyncEnumerable<PlaygroundEvent> ThrowNotImplementedAsync()
    {
        await Task.Yield();
        throw new NotImplementedException();
#pragma warning disable CS0162
        yield break;
#pragma warning restore CS0162
    }

    private static async IAsyncEnumerable<PlaygroundEvent> ThrowAsync(Exception ex)
    {
        await Task.Yield();
        throw ex;
#pragma warning disable CS0162
        yield break;
#pragma warning restore CS0162
    }
}
