namespace Proxytrace.Domain.AuditLog;

/// <summary>
/// Who performed an audited action: an interactive <see cref="User"/>, an external caller
/// authenticating with an <see cref="ApiKey"/> (attributed to the key's owner), or the
/// <see cref="System"/> itself (scheduler / background work with no request context).
/// </summary>
public enum AuditActorType
{
    User = 0,
    ApiKey = 1,
    System = 2,
}
