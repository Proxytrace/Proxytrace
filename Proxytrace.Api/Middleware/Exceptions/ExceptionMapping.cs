namespace Proxytrace.Api.Middleware.Exceptions;

/// <summary>
/// The HTTP response shape an <see cref="IExceptionMapper"/> produces for an exception:
/// status code, the wire "type" discriminator, and any exception-specific payload fields.
/// <see cref="Message"/> replaces the raw exception message on the wire when set — use it
/// whenever the exception text may contain internals (SQL, schema names, file paths).
/// </summary>
internal sealed record ExceptionMapping
{
    public required int StatusCode { get; init; }
    public required string TypeName { get; init; }
    public string? Message { get; init; }
    public IReadOnlyDictionary<string, object?>? AdditionalFields { get; init; }
}
