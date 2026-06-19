using Proxytrace.Domain.Notification;

namespace Proxytrace.Storage.Internal.Entities.Notification;

[StoredDomainEntity(typeof(INotification))]
internal record NotificationEntity : Entity
{
    /// <summary><see cref="INotification.Kind"/></summary>
    public required NotificationKind Kind { get; init; }

    /// <summary><see cref="INotification.Severity"/></summary>
    public required NotificationSeverity Severity { get; init; }

    /// <summary><see cref="INotification.Title"/></summary>
    public required string Title { get; init; }

    /// <summary><see cref="INotification.Message"/></summary>
    public required string Message { get; init; }

    /// <summary><see cref="INotification.Status"/></summary>
    public required NotificationStatus Status { get; init; }

    /// <summary><see cref="INotification.ProjectId"/>. Null for global/system notifications.</summary>
    public Guid? ProjectId { get; init; }

    /// <summary><see cref="INotification.TargetKind"/></summary>
    public NotificationTargetKind? TargetKind { get; init; }

    /// <summary><see cref="INotification.TargetId"/>. Soft reference — not a foreign key.</summary>
    public Guid? TargetId { get; init; }
}
