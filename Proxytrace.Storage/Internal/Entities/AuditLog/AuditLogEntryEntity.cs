using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Storage.Internal.Entities.AuditLog;

[StoredDomainEntity(typeof(IAuditLogEntry))]
internal record AuditLogEntryEntity : Entity
{
    public required AuditAction Action { get; init; }

    public required AuditActorType ActorType { get; init; }

    public Guid? ActorUserId { get; init; }

    public string? ActorEmail { get; init; }

    public Guid? ActorApiKeyId { get; init; }

    public Guid? ProjectId { get; init; }

    public required string TargetType { get; init; }

    public Guid? TargetId { get; init; }

    public string? TargetLabel { get; init; }

    public string? Details { get; init; }

    public required AuditOutcome Outcome { get; init; }
}
