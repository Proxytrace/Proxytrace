using Proxytrace.Domain.Notification;

namespace Proxytrace.Api.Dto.Notifications;

/// <summary>
/// Body for the test-only notification seed endpoint. Mirrors <c>NotificationRequest</c>, but the
/// row is written directly so a spec can seed several notifications for the same target (the
/// production path de-duplicates those) and can point one at a target that does not exist.
/// </summary>
public record SeedNotificationRequest(
    NotificationKind Kind,
    NotificationSeverity Severity,
    string Title,
    string Message,
    Guid? ProjectId,
    NotificationTargetKind? TargetKind = null,
    Guid? TargetId = null);
