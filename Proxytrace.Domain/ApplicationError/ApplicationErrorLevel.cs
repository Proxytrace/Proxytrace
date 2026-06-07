namespace Proxytrace.Domain.ApplicationError;

/// <summary>
/// Severity of a captured <see cref="IApplicationError"/>, mirroring the
/// <c>LogLevel.Error</c> / <c>LogLevel.Critical</c> entries that are captured.
/// </summary>
public enum ApplicationErrorLevel
{
    Error = 0,
    Critical = 1,
}
