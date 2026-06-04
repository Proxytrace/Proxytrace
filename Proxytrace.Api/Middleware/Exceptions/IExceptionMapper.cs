namespace Proxytrace.Api.Middleware.Exceptions;

/// <summary>
/// Maps a specific family of exceptions to an HTTP <see cref="ExceptionMapping"/>.
/// New exception types plug in by registering an additional implementation; the
/// exception-handling middleware resolves all of them and picks the first match.
/// </summary>
internal interface IExceptionMapper
{
    bool CanMap(Exception exception);

    ExceptionMapping Map(Exception exception);
}
