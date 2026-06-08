using Microsoft.Extensions.Logging;
using Proxytrace.Domain.ApplicationError;

namespace Proxytrace.Application.ErrorLog.Internal;

/// <summary>
/// Captures every <c>Error</c>/<c>Critical</c> log entry onto the <see cref="IErrorLogChannel"/>.
/// Categories under the error-log pipeline itself and EF Core are skipped: a failed DB write makes
/// EF (and our own writer/cleanup) log at Error level, which must not re-enter the channel and loop.
/// </summary>
internal sealed class ErrorLogChannelLogger : ILogger
{
    private const string SelfCategoryPrefix = "Proxytrace.Application.ErrorLog";
    private const string EfCategoryPrefix = "Microsoft.EntityFrameworkCore";

    private readonly string category;
    private readonly IErrorLogChannel channel;

    public ErrorLogChannelLogger(string category, IErrorLogChannel channel)
    {
        this.category = category;
        this.channel = channel;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel) || ShouldSkip(category))
        {
            return;
        }

        var message = formatter(state, exception);
        if (string.IsNullOrWhiteSpace(message))
        {
            message = exception?.Message ?? "(no message)";
        }

        var level = logLevel == LogLevel.Critical
            ? ApplicationErrorLevel.Critical
            : ApplicationErrorLevel.Error;

        var entry = new ErrorLogEntry(
            message,
            level,
            category,
            exception?.GetType().FullName,
            exception?.ToString());

        // Drop on full — never block the caller on the logging hot path.
        channel.TryWrite(entry);
    }

    private static bool ShouldSkip(string category)
        => category.StartsWith(SelfCategoryPrefix, StringComparison.Ordinal)
           || category.StartsWith(EfCategoryPrefix, StringComparison.Ordinal);
}
