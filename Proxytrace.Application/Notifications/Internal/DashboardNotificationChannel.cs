using Microsoft.Extensions.Logging;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications.Internal;

/// <summary>
/// Persists notifications so the dashboard section can read them, and pushes a live SSE event so
/// open dashboards update immediately. De-duplicates against an existing active notification for the
/// same target so a recurring condition on the same entity doesn't spam the list.
/// </summary>
internal sealed class DashboardNotificationChannel : INotificationChannel
{
    private readonly INotificationRepository notifications;
    private readonly INotification.CreateNew createNotification;
    private readonly INotificationBroadcaster broadcaster;
    private readonly ILogger<DashboardNotificationChannel> logger;

    public DashboardNotificationChannel(
        INotificationRepository notifications,
        INotification.CreateNew createNotification,
        INotificationBroadcaster broadcaster,
        ILogger<DashboardNotificationChannel> logger)
    {
        this.notifications = notifications;
        this.createNotification = createNotification;
        this.broadcaster = broadcaster;
        this.logger = logger;
    }

    public string Name => "Dashboard";

    public async Task DeliverAsync(NotificationRequest request, CancellationToken cancellationToken = default)
    {
        if (request.TargetKind is { } targetKind && request.TargetId is { } targetId)
        {
            var existing = await notifications.FindActiveByTargetAsync(targetKind, targetId, cancellationToken);
            if (existing is not null)
            {
                logger.LogDebug(
                    "Suppressing duplicate dashboard notification for {TargetKind} {TargetId}",
                    targetKind, targetId);
                return;
            }
        }

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
