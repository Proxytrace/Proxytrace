using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Application.AuditLog;

/// <summary>
/// A synchronous snapshot of who is performing the current action, captured at log time without any
/// I/O. Resolved by <see cref="IAuditActorAccessor"/> from the ambient request context.
/// </summary>
public sealed record AuditActor(
    AuditActorType Type,
    Guid? UserId,
    string? Email,
    Guid? ApiKeyId)
{
    /// <summary>The actor for work with no request context (scheduler, background services).</summary>
    public static readonly AuditActor System = new(AuditActorType.System, null, null, null);
}

/// <summary>
/// Resolves the current <see cref="AuditActor"/> from the ambient request context. Implemented in the
/// API layer over <c>IHttpContextAccessor</c>; absent in non-HTTP hosts (tests, kiosk), where the
/// audit pipeline falls back to <see cref="AuditActor.System"/>.
/// </summary>
public interface IAuditActorAccessor
{
    /// <summary>
    /// Returns the current actor from the request context with no I/O (no DB hit), or
    /// <see cref="AuditActor.System"/> when there is no request (background work).
    /// </summary>
    AuditActor GetCurrentActor();
}
