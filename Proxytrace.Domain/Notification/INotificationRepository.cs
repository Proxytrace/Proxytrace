namespace Proxytrace.Domain.Notification;

/// <summary>
/// Repository for <see cref="INotification"/> entities.
/// </summary>
public interface INotificationRepository : IRepository<INotification>
{
    /// <summary>
    /// Returns the non-dismissed notifications visible in the given scope — global notifications
    /// (<see cref="INotification.ProjectId"/> is <see langword="null"/>) plus those matching
    /// <paramref name="projectId"/> when supplied — ordered newest first. When
    /// <paramref name="includeRead"/> is false only <see cref="NotificationStatus.Unread"/> rows
    /// are returned.
    /// </summary>
    Task<IReadOnlyList<INotification>> GetForScopeAsync(
        Guid? projectId,
        bool includeRead,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts the unread notifications visible in the given scope (global plus
    /// <paramref name="projectId"/>). Used for the dashboard badge.
    /// </summary>
    Task<int> CountUnreadAsync(
        Guid? projectId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the most-recent non-dismissed notification pointing at the given target, or
    /// <see langword="null"/> if none exists. Used to de-duplicate repeated alerts for the same
    /// target (e.g. one alert per failed test-run group).
    /// </summary>
    Task<INotification?> FindActiveByTargetAsync(
        NotificationTargetKind targetKind,
        Guid targetId,
        CancellationToken cancellationToken = default);
}
