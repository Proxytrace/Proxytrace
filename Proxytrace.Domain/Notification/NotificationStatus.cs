namespace Proxytrace.Domain.Notification;

/// <summary>
/// Lifecycle state of a <see cref="INotification"/>. v1 state is global (shared across users),
/// not per-user.
/// </summary>
public enum NotificationStatus
{
    /// <summary>Newly created; counts toward the unread badge.</summary>
    Unread,

    /// <summary>Seen by a user but still shown in the list.</summary>
    Read,

    /// <summary>Dismissed; hidden from the list. Terminal.</summary>
    Dismissed,
}
