namespace Proxytrace.Application.Notifications;

/// <summary>
/// A delivery channel for notifications. The extensibility seam of the notification system:
/// <see cref="INotificationService"/> resolves every registered channel and delivers each request
/// to all of them. v1 ships the dashboard channel (persists + live SSE); a future email channel
/// drops in with no caller changes.
/// </summary>
public interface INotificationChannel
{
    /// <summary>A stable, human-readable channel name for logging (e.g. "Dashboard", "Email").</summary>
    string Name { get; }

    /// <summary>Delivers the notification over this channel.</summary>
    Task DeliverAsync(NotificationRequest request, CancellationToken cancellationToken = default);
}
