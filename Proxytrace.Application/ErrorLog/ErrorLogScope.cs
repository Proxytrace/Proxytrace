namespace Proxytrace.Application.ErrorLog;

/// <summary>
/// Well-known logging-scope key used to pre-assign the primary key of a captured error. When a
/// caller (the API exception middleware) logs an Error/Critical entry inside a scope carrying this
/// key, the error-log capture pipeline persists the row with that exact <see cref="System.Guid"/>
/// instead of a freshly generated one. This lets the API return the same id to the client so an
/// admin can deep-link straight to the captured error in the Error Log.
/// </summary>
public static class ErrorLogScope
{
    /// <summary>Scope key whose value is a <see cref="System.Guid"/> to use as the captured error's id.</summary>
    public const string ErrorIdKey = "ErrorLogId";
}
