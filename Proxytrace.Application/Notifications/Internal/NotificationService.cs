using Microsoft.Extensions.Logging;

namespace Proxytrace.Application.Notifications.Internal;

internal sealed class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationChannel> channels;
    private readonly ILogger<NotificationService> logger;

    public NotificationService(
        IEnumerable<INotificationChannel> channels,
        ILogger<NotificationService> logger)
    {
        this.channels = channels;
        this.logger = logger;
    }

    public async Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken = default)
    {
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
