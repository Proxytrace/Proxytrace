using Microsoft.Extensions.Logging;
using Proxytrace.Application.AuditLog.Internal;
using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Application.AuditLog;

/// <summary>
/// ILogger-native API for recording audit events. Call sites inject <see cref="ILogger{Audit}"/> and
/// call <see cref="LogAudit"/>; the actor (user / API key / system) is enriched automatically from the
/// request context by the capture pipeline, so call sites only supply the action and its target.
/// </summary>
public static class AuditLogExtensions
{
    /// <summary>
    /// Records an audited action. Emit this after the action has succeeded. The acting user is
    /// resolved automatically; pass <paramref name="projectId"/> for project-scoped actions and
    /// leave it <see langword="null"/> for instance-wide (global) actions. <paramref name="details"/>
    /// should be a pre-serialized JSON string of any action-specific context.
    /// </summary>
    public static void LogAudit(
        this ILogger<Audit> logger,
        AuditAction action,
        string targetType,
        Guid? targetId = null,
        string? targetLabel = null,
        Guid? projectId = null,
        string? details = null,
        AuditOutcome outcome = AuditOutcome.Success)
    {
        var state = new AuditState(action, targetType, targetId, targetLabel, projectId, details, outcome);
        logger.Log(LogLevel.Information, new EventId((int)action, action.ToString()), state, exception: null, AuditState.Format);
    }
}
