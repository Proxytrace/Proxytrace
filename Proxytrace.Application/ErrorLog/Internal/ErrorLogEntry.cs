using Proxytrace.Domain.ApplicationError;

namespace Proxytrace.Application.ErrorLog.Internal;

/// <summary>
/// An in-flight captured error queued on the <see cref="IErrorLogChannel"/> before it is
/// persisted as an <see cref="IApplicationError"/> by the <see cref="ErrorLogWriter"/>.
/// </summary>
/// <param name="Id">
/// Pre-assigned primary key for the persisted row, set when the caller logged inside an
/// <see cref="ErrorLog.ErrorLogScope.ErrorIdKey"/> scope (so the API can deep-link to it).
/// <see langword="null"/> for ordinary captures, which get a freshly generated id.
/// </param>
internal sealed record ErrorLogEntry(
    string Message,
    ApplicationErrorLevel Level,
    string Category,
    string? ExceptionType,
    string? StackTrace,
    Guid? Id = null);
