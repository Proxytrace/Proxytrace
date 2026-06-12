namespace Proxytrace.Licensing;

/// <summary>
/// Where the currently active license came from.
/// </summary>
public enum LicenseSource
{
    /// <summary>
    /// No license is configured; the deployment runs the Free tier.
    /// </summary>
    None,

    /// <summary>
    /// The license JWT was supplied via the environment (or configuration file).
    /// </summary>
    Environment,

    /// <summary>
    /// The license JWT was set at runtime (setup wizard or settings UI) and is persisted in the
    /// database. A stored license takes precedence over an environment-supplied one.
    /// </summary>
    Stored,

    /// <summary>
    /// A pre-resolved override snapshot (kiosk/demo deployments). Not user-manageable.
    /// </summary>
    Override,
}
