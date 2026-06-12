using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Api.Middleware.Exceptions;

internal sealed class InvalidLicenseExceptionMapper : IExceptionMapper
{
    public bool CanMap(Exception exception) => exception is InvalidLicenseException;

    public ExceptionMapping Map(Exception exception)
    {
        var invalid = (InvalidLicenseException)exception;
        return new ExceptionMapping
        {
            StatusCode = StatusCodes.Status422UnprocessableEntity,
            TypeName = "InvalidLicense",
            AdditionalFields = new Dictionary<string, object?>
            {
                ["reason"] = invalid.Reason.ToString(),
            },
        };
    }
}
