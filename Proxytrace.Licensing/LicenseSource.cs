namespace Proxytrace.Licensing;

/// <summary>
/// Where the currently active license came from.
/// </summary>
public enum LicenseSource
{
    /// <summary>
    /// No support key is configured.
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
}
