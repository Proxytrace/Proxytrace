using System.Text.Json;
using AwesomeAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Api.Middleware;
using Proxytrace.Api.Middleware.Exceptions;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Licensing;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Api.Tests.Middleware;

[TestClass]
public sealed class ExceptionHandlingMiddlewareTests
{
    private static ExceptionHandlingMiddleware Create(RequestDelegate next, bool isDevelopment = false)
    {
        var env = Substitute.For<IWebHostEnvironment>();
        env.EnvironmentName.Returns(isDevelopment ? "Development" : "Production");

        IExceptionMapper[] mappers =
        [
            new EntityNotFoundExceptionMapper(),
            new EntityConflictExceptionMapper(),
            new NotImplementedExceptionMapper(),
            new FeatureNotLicensedExceptionMapper(),
            new LicenseLimitExceededExceptionMapper(),
        ];

        return new ExceptionHandlingMiddleware(
            next, NullLogger<ExceptionHandlingMiddleware>.Instance, mappers, env);
    }

    private static async Task<(int Status, string Body)> InvokeAsync(ExceptionHandlingMiddleware middleware)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(ctx);

        ctx.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(ctx.Response.Body);
        return (ctx.Response.StatusCode, await reader.ReadToEndAsync());
    }

    private static JsonElement Error(string body)
    {
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("error").Clone();
    }

    [TestMethod]
    public async Task InvokeAsync_NoException_DoesNotWriteErrorBody()
    {
        var middleware = Create(_ => Task.CompletedTask);

        var (status, body) = await InvokeAsync(middleware);

        status.Should().Be(StatusCodes.Status200OK);
        body.Should().BeEmpty();
    }

    [TestMethod]
    public async Task InvokeAsync_EntityNotFound_Returns404()
    {
        var middleware = Create(_ => throw new EntityNotFoundException(Guid.NewGuid(), typeof(object)));

        var (status, body) = await InvokeAsync(middleware);

        status.Should().Be(StatusCodes.Status404NotFound);
        Error(body).GetProperty("type").GetString().Should().Be(nameof(EntityNotFoundException));
    }

    [TestMethod]
    public async Task InvokeAsync_NotImplemented_Returns501()
    {
        var middleware = Create(_ => throw new NotImplementedException());

        var (status, _) = await InvokeAsync(middleware);

        status.Should().Be(StatusCodes.Status501NotImplemented);
    }

    [TestMethod]
    public async Task InvokeAsync_FeatureNotLicensed_Returns402_WithFeatureFields()
    {
        var middleware = Create(_ =>
            throw new FeatureNotLicensedException(LicenseFeature.CustomEvaluators, LicenseTier.Free));

        var (status, body) = await InvokeAsync(middleware);

        status.Should().Be(StatusCodes.Status402PaymentRequired);
        var error = Error(body);
        error.GetProperty("type").GetString().Should().Be("FeatureNotLicensed");
        error.GetProperty("feature").GetString().Should().Be(nameof(LicenseFeature.CustomEvaluators));
        error.GetProperty("tier").GetString().Should().Be(nameof(LicenseTier.Free));
    }

    [TestMethod]
    public async Task InvokeAsync_UnknownException_Returns500()
    {
        var middleware = Create(_ => throw new InvalidOperationException("boom"));

        var (status, body) = await InvokeAsync(middleware);

        status.Should().Be(StatusCodes.Status500InternalServerError);
        Error(body).GetProperty("message").GetString().Should().Be("boom");
    }

    [TestMethod]
    public async Task InvokeAsync_Development_IncludesStacktrace()
    {
        var middleware = Create(_ => throw new InvalidOperationException("boom"), isDevelopment: true);

        var (_, body) = await InvokeAsync(middleware);

        Error(body).GetProperty("stacktrace").GetString().Should().NotBeNullOrEmpty();
    }

    [TestMethod]
    public async Task InvokeAsync_Production_OmitsStacktrace()
    {
        var middleware = Create(_ => throw new InvalidOperationException("boom"));

        var (_, body) = await InvokeAsync(middleware);

        Error(body).GetProperty("stacktrace").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [TestMethod]
    public async Task InvokeAsync_OperationCanceled_Propagates()
    {
        var middleware = Create(_ => throw new OperationCanceledException());

        await FluentActions
            .Invoking(() => InvokeAsync(middleware))
            .Should().ThrowAsync<OperationCanceledException>();
    }
}
