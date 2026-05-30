using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing;

/// <summary>
/// Extension methods that enforce a numeric license limit before an operation that would consume
/// one more unit of a capped resource.
/// </summary>
public static class LicenseServiceExtensions
{
    /// <summary>
    /// Throws <see cref="LicenseLimitExceededException"/> when adding one more unit would exceed
    /// the limit (i.e. <paramref name="current"/> is already at or above the cap). Unlimited
    /// limits (<see cref="long.MaxValue"/>) are never enforced.
    /// </summary>
    public static void Ensure(this ILicenseService service, LicenseLimit limit, long current)
    {
        ArgumentNullException.ThrowIfNull(service);

        var max = service.GetLimit(limit);
        if (max == long.MaxValue)
            return;

        if (current >= max)
            throw new LicenseLimitExceededException(limit, current, max);
    }
}
