using Proxytrace.Domain.Notification;

namespace Proxytrace.Api.Dto.Notifications;

/// <summary>
/// API representation of an <see cref="INotification"/>.
/// </summary>
public record NotificationDto(
    Guid Id,
    NotificationKind Kind,
    NotificationSeverity Severity,
    string Title,
    string Message,
    NotificationStatus Status,
    Guid? ProjectId,
    NotificationTargetKind? TargetKind,
    Guid? TargetId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
