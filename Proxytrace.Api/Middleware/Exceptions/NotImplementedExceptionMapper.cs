namespace Proxytrace.Api.Middleware.Exceptions;

internal sealed class NotImplementedExceptionMapper : IExceptionMapper
{
    public bool CanMap(Exception exception) => exception is NotImplementedException;

    public ExceptionMapping Map(Exception exception) => new()
    {
        StatusCode = StatusCodes.Status501NotImplemented,
        TypeName = exception.GetType().Name,
    };
}
