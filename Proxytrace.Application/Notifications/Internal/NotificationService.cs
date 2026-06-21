using Microsoft.Extensions.Logging;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications.Internal;

internal sealed class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationChannel> channels;
    private readonly INotificationRepository notifications;
    private readonly ILogger<NotificationService> logger;

    public NotificationService(
        IEnumerable<INotificationChannel> channels,
        INotificationRepository notifications,
        ILogger<NotificationService> logger)
    {
        this.channels = channels;
        this.notifications = notifications;
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

        foreach (var channel in channels)
        {
            try
            {
                await channel.DeliverAsync(request, cancellationToken);
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
                    request.Title);
            }
        }
    }
}
