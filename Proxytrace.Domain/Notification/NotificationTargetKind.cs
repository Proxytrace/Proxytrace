namespace Proxytrace.Domain.Notification;

/// <summary>
/// The kind of entity a <see cref="INotification"/> points at. Lets the frontend build the right
/// deep-link route from <see cref="INotification.TargetId"/> without a polymorphic foreign key.
/// </summary>
public enum NotificationTargetKind
{
    /// <summary>The notification points at an <c>ITestRunGroup</c>.</summary>
    TestRunGroup,

    /// <summary>The notification points at an <c>IAgent</c>.</summary>
    Agent,

    /// <summary>The notification points at an <c>IOptimizationProposal</c>.</summary>
    OptimizationProposal,
}
