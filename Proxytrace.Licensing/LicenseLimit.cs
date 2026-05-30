namespace Proxytrace.Licensing;

/// <summary>
/// A numeric usage limit enforced by the active license tier.
/// </summary>
public enum LicenseLimit
{
    MaxProjects,
    MaxUsers,
    MaxTracesPerMonth,
    TraceRetentionDays,
}
