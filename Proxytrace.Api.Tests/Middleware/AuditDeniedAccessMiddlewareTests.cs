using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Proxytrace.Api.Middleware;
using Proxytrace.Application.AuditLog;
using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Api.Tests.Middleware;

[TestClass]
public sealed class AuditDeniedAccessMiddlewareTests
{
    private static async Task<RecordingAuditLogger> InvokeAsync(string method, int downstreamStatus)
    {
        var audit = new RecordingAuditLogger();
        var middleware = new AuditDeniedAccessMiddleware(
            ctx =>
            {
                ctx.Response.StatusCode = downstreamStatus;
                return Task.CompletedTask;
            },
            audit);

        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method;
        ctx.Request.Path = "/api/users/123/role";

        await middleware.InvokeAsync(ctx);
        return audit;
    }

    [TestMethod]
    public async Task InvokeAsync_MutatingRequestForbidden_AuditsAccessDenied()
    {
        var audit = await InvokeAsync("POST", StatusCodes.Status403Forbidden);

        audit.Events.Should().ContainSingle().Which.Id.Should().Be((int)AuditAction.AccessDenied);
    }

    [TestMethod]
    public async Task InvokeAsync_DeleteForbidden_AuditsAccessDenied()
    {
        var audit = await InvokeAsync("DELETE", StatusCodes.Status403Forbidden);

        audit.Events.Should().ContainSingle().Which.Id.Should().Be((int)AuditAction.AccessDenied);
    }

    [TestMethod]
    public async Task InvokeAsync_ReadRequestForbidden_RecordsNothing()
    {
        // A forbidden GET is not a denied mutation — don't audit it (it would be noise).
        var audit = await InvokeAsync("GET", StatusCodes.Status403Forbidden);

        audit.Events.Should().BeEmpty();
    }

    [TestMethod]
    public async Task InvokeAsync_MutatingRequestUnauthorized_RecordsNothing()
    {
        // 401 carries no actor and overlaps LoginFailed; only 403 (authenticated-but-forbidden) is audited.
        var audit = await InvokeAsync("POST", StatusCodes.Status401Unauthorized);

        audit.Events.Should().BeEmpty();
    }

    [TestMethod]
    public async Task InvokeAsync_MutatingRequestSucceeds_RecordsNothing()
    {
        var audit = await InvokeAsync("PUT", StatusCodes.Status200OK);

        audit.Events.Should().BeEmpty();
    }

    private sealed class RecordingAuditLogger : ILogger<Audit>
    {
        public List<EventId> Events { get; } = [];

        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Events.Add(eventId);

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();

            public void Dispose()
            {
            }
        }
    }
}
