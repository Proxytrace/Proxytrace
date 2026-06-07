using Proxytrace.Domain.ApplicationError;

namespace Proxytrace.Application.ErrorLog.Internal;

/// <summary>
/// An in-flight captured error queued on the <see cref="IErrorLogChannel"/> before it is
/// persisted as an <see cref="IApplicationError"/> by the <see cref="ErrorLogWriter"/>.
/// </summary>
internal sealed record ErrorLogEntry(
    string Message,
    ApplicationErrorLevel Level,
    string Category,
    string? ExceptionType,
    string? StackTrace);
