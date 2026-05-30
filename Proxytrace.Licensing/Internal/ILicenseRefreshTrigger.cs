namespace Proxytrace.Licensing.Internal;

/// <summary>
/// Triggers an immediate license server check. Implemented by the background check service and
/// invoked by <see cref="LicenseService.ForceRefreshAsync"/>; the indirection breaks the
/// construction cycle between the two singletons.
/// </summary>
internal interface ILicenseRefreshTrigger
{
    /// <summary>
    /// Runs a single license check now and applies any resulting snapshot change.
    /// </summary>
    Task RunCheckNowAsync(CancellationToken cancellationToken);
}
