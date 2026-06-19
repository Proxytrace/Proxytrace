namespace Proxytrace.Application.Notifications;

/// <summary>
/// Single entry point for raising a notification. Fans the request out to every registered
/// <see cref="INotificationChannel"/>.
/// </summary>
public interface INotificationService
{
    Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken = default);
}
