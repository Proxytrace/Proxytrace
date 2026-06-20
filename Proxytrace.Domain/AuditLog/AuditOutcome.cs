namespace Proxytrace.Domain.AuditLog;

/// <summary>Whether the audited action succeeded. Defaults to <see cref="Success"/>.</summary>
public enum AuditOutcome
{
    Success = 0,
    Failure = 1,
}
