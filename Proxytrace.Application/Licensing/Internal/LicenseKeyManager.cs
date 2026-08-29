using Proxytrace.Domain.Licensing;
using Proxytrace.Licensing;

namespace Proxytrace.Application.Licensing.Internal;

internal sealed class LicenseKeyManager : ILicenseKeyManager
{
    private readonly IStoredLicenseStore store;
    private readonly ILicenseActivator activator;

    /// <summary>
    /// Initializes a new instance of the <see cref="LicenseKeyManager"/> class.
    /// </summary>
    public LicenseKeyManager(
        IStoredLicenseStore store,
        ILicenseActivator activator)
    {
        this.store = store;
        this.activator = activator;
    }

    /// <summary>
    /// Validates.
    /// </summary>
    public LicenseSnapshot Validate(string licenseJwt)
        => activator.Validate(licenseJwt);

    /// <summary>
    /// Sets asynchronously.
    /// </summary>
    public async Task<LicenseSnapshot> SetAsync(string licenseJwt, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(licenseJwt);
        // Validate before persisting so a rejected JWT never replaces the stored license.
        activator.Validate(licenseJwt);

        await store.SaveAsync(licenseJwt.Trim(), cancellationToken);
        return activator.Activate(licenseJwt.Trim(), LicenseSource.Stored);
    }

    /// <summary>
    /// Removes asynchronously.
    /// </summary>
    public async Task<LicenseSnapshot> RemoveAsync(CancellationToken cancellationToken = default)
    {
        await store.RemoveAsync(cancellationToken);
        return activator.ActivateConfigured();
    }
}
