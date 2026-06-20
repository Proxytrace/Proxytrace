using System.Collections;
using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Application.AuditLog.Internal;

/// <summary>
/// Strongly-typed log state produced by <see cref="AuditLogExtensions.LogAudit"/> and recognized by
/// <see cref="AuditChannelLogger"/> via a single type check. Carries the call-site-supplied fields of
/// an audit event (the actor is enriched later from the request context). Implements the key/value
/// list contract so the entry also renders structurally in ordinary log sinks (e.g. console).
/// </summary>
internal readonly struct AuditState : IReadOnlyList<KeyValuePair<string, object?>>
{
    public AuditAction Action { get; }
    public string TargetType { get; }
    public Guid? TargetId { get; }
    public string? TargetLabel { get; }
    public Guid? ProjectId { get; }
    public string? Details { get; }
    public AuditOutcome Outcome { get; }

    public AuditState(
        AuditAction action,
        string targetType,
        Guid? targetId,
        string? targetLabel,
        Guid? projectId,
        string? details,
        AuditOutcome outcome)
    {
        Action = action;
        TargetType = targetType;
        TargetId = targetId;
        TargetLabel = targetLabel;
        ProjectId = projectId;
        Details = details;
        Outcome = outcome;
    }

    public static string Format(AuditState state, Exception? _)
        => $"Audit {state.Action}: {state.TargetType}"
           + (state.TargetId is { } id ? $" {id}" : string.Empty)
           + (state.TargetLabel is { Length: > 0 } label ? $" ({label})" : string.Empty);

    public int Count => 7;

    public KeyValuePair<string, object?> this[int index] => index switch
    {
        0 => new KeyValuePair<string, object?>("Action", Action),
        1 => new KeyValuePair<string, object?>("TargetType", TargetType),
        2 => new KeyValuePair<string, object?>("TargetId", TargetId),
        3 => new KeyValuePair<string, object?>("TargetLabel", TargetLabel),
        4 => new KeyValuePair<string, object?>("ProjectId", ProjectId),
        5 => new KeyValuePair<string, object?>("Details", Details),
        6 => new KeyValuePair<string, object?>("Outcome", Outcome),
        _ => throw new ArgumentOutOfRangeException(nameof(index)),
    };

    public IEnumerator<KeyValuePair<string, object?>> GetEnumerator()
    {
        for (var i = 0; i < Count; i++)
        {
            yield return this[i];
        }
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
