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

    /// <summary>
    /// A license was configured but failed validation (malformed, bad signature, expired, …).
    /// The deployment reports no support contract until the key is corrected.
    /// </summary>
    Invalid,
}
