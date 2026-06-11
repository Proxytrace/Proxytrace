using Proxytrace.Application.Auth;

namespace Proxytrace.Api.Middleware.Exceptions;

internal sealed class UserAdministrationExceptionMapper : IExceptionMapper
{
    public bool CanMap(Exception exception)
        => exception is UserAdministrationException;

    public ExceptionMapping Map(Exception exception) => new()
    {
        StatusCode = StatusCodes.Status409Conflict,
        TypeName = exception.GetType().Name,
    };
}
