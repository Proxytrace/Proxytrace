namespace Proxytrace.Licensing;

/// <summary>
/// The runtime status of the active license.
/// </summary>
public enum LicenseStatus
{
    Free,
    Active,
    Grace,
    Expired,
}
