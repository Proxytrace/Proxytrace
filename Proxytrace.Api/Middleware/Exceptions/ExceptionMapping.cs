namespace Proxytrace.Api.Middleware.Exceptions;

/// <summary>
/// The HTTP response shape an <see cref="IExceptionMapper"/> produces for an exception:
/// status code, the wire "type" discriminator, and any exception-specific payload fields.
/// </summary>
internal sealed record ExceptionMapping
{
    public required int StatusCode { get; init; }
    public required string TypeName { get; init; }
    public IReadOnlyDictionary<string, object?>? AdditionalFields { get; init; }
}
