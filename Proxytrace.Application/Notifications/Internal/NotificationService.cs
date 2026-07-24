using Microsoft.Extensions.Logging;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications.Internal;

internal sealed class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationChannel> channels;
    private readonly INotificationRepository notifications;
    private readonly INotification.CreateNew createNotification;
    private readonly ILogger<NotificationService> logger;

    public NotificationService(
        IEnumerable<INotificationChannel> channels,
        INotificationRepository notifications,
        INotification.CreateNew createNotification,
        ILogger<NotificationService> logger)
    {
        this.channels = channels;
        this.notifications = notifications;
        this.createNotification = createNotification;
        this.logger = logger;
    }

    public async Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken = default)
    {
        if (request.TargetKind is { } targetKind && request.TargetId is { } targetId)
        {
            var existing = await notifications.FindActiveByTargetAsync(targetKind, targetId, cancellationToken);
            if (existing is not null)
            {
                logger.LogDebug(
                    "Suppressing duplicate notification for {TargetKind} {TargetId}",
                    targetKind, targetId);
                return;
            }
        }

        // The notification *is* the record: it is created here, once, before any channel runs, so
        // every channel delivers the same persisted entity and can reference it by id.
        var notification = await notifications.AddAsync(
            createNotification(
                request.Kind,
                request.Severity,
                request.Title,
                request.Message,
                request.ProjectId,
                request.TargetKind,
                request.TargetId),
            cancellationToken);

        foreach (var channel in channels)
        {
            try
            {
                await channel.DeliverAsync(notification, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // One channel failing must not block the others (e.g. email down shouldn't drop the
                // dashboard alert).
                logger.LogWarning(
                    ex,
                    "Notification channel {Channel} failed to deliver '{Title}'",
                    channel.Name,
                    notification.Title);
            }
        }
    }
}
