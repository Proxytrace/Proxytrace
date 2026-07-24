using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications;

/// <summary>
/// A delivery channel for notifications. The extensibility seam of the notification system:
/// <see cref="INotificationService"/> persists the notification once and then delivers the same
/// entity to every registered channel. Channels only <em>deliver</em> — they never create or store
/// the record, so each one can reference the notification by its id (e.g. an email deep-link).
/// </summary>
public interface INotificationChannel
{
    /// <summary>A stable, human-readable channel name for logging (e.g. "Dashboard", "Email").</summary>
    string Name { get; }

    /// <summary>Delivers the already-persisted notification over this channel.</summary>
    Task DeliverAsync(INotification notification, CancellationToken cancellationToken = default);
}
