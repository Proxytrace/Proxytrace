using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Api.Middleware.Exceptions;

internal sealed class FeatureNotLicensedExceptionMapper : IExceptionMapper
{
    public bool CanMap(Exception exception) => exception is FeatureNotLicensedException;

    public ExceptionMapping Map(Exception exception)
    {
        var feature = (FeatureNotLicensedException)exception;
        return new ExceptionMapping
        {
            StatusCode = StatusCodes.Status402PaymentRequired,
            TypeName = "FeatureNotLicensed",
            AdditionalFields = new Dictionary<string, object?>
            {
                ["feature"] = feature.Feature.ToString(),
                ["tier"] = feature.Tier.ToString(),
            },
        };
    }
}
