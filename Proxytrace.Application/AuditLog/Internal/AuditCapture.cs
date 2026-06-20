using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Application.AuditLog.Internal;

/// <summary>
/// An in-flight captured audit event queued on the <see cref="IAuditChannel"/> before it is persisted
/// as an <see cref="IAuditLogEntry"/> by the <see cref="AuditWriter"/>. The actor and
/// <see cref="OccurredAt"/> are captured synchronously at log time (the writer has no request context),
/// so <see cref="OccurredAt"/> — not the later persist time — becomes the row's <c>CreatedAt</c>.
/// </summary>
internal sealed record AuditCapture(
    AuditAction Action,
    AuditActorType ActorType,
    Guid? ActorUserId,
    string? ActorEmail,
    Guid? ActorApiKeyId,
    Guid? ProjectId,
    string TargetType,
    Guid? TargetId,
    string? TargetLabel,
    string? Details,
    AuditOutcome Outcome,
    DateTimeOffset OccurredAt);
