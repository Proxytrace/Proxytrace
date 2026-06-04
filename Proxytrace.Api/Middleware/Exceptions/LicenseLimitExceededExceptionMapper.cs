using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Api.Middleware.Exceptions;

internal sealed class LicenseLimitExceededExceptionMapper : IExceptionMapper
{
    public bool CanMap(Exception exception) => exception is LicenseLimitExceededException;

    public ExceptionMapping Map(Exception exception)
    {
        var limit = (LicenseLimitExceededException)exception;
        return new ExceptionMapping
        {
            StatusCode = StatusCodes.Status402PaymentRequired,
            TypeName = "LicenseLimitExceeded",
            AdditionalFields = new Dictionary<string, object?>
            {
                ["limit"] = limit.Limit.ToString(),
                ["current"] = limit.Current,
                ["max"] = limit.Max,
            },
        };
    }
}
