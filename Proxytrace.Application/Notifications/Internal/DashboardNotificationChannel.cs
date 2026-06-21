using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications.Internal;

/// <summary>
/// Persists notifications so the dashboard section can read them, and pushes a live SSE event so
/// open dashboards update immediately. De-duplication against active notifications for the same
/// target is handled upstream by <see cref="NotificationService"/> before any channel is invoked.
/// </summary>
internal sealed class DashboardNotificationChannel : INotificationChannel
{
    private readonly INotificationRepository notifications;
    private readonly INotification.CreateNew createNotification;
    private readonly INotificationBroadcaster broadcaster;

    public DashboardNotificationChannel(
        INotificationRepository notifications,
        INotification.CreateNew createNotification,
        INotificationBroadcaster broadcaster)
    {
        this.notifications = notifications;
        this.createNotification = createNotification;
        this.broadcaster = broadcaster;
    }

    public string Name => "Dashboard";

    public async Task DeliverAsync(NotificationRequest request, CancellationToken cancellationToken = default)
    {
        var notification = createNotification(
            request.Kind,
            request.Severity,
            request.Title,
            request.Message,
            request.ProjectId,
            request.TargetKind,
            request.TargetId);

        notification = await notifications.AddAsync(notification, cancellationToken);
        broadcaster.Publish(NotificationCreatedEvent.Create(notification));
    }
}
