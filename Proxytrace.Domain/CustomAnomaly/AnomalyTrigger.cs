namespace Proxytrace.Domain.CustomAnomaly;

/// <summary>
/// How a trigger's <see cref="AnomalyTrigger.Pattern"/> is matched against a conversation turn.
/// </summary>
public enum TriggerKind
{
    /// <summary>Case-insensitive literal phrase containment.</summary>
    Phrase,

    /// <summary>
    /// Case-insensitive regular expression, compiled with <c>RegexOptions.NonBacktracking</c> so a
    /// user-supplied pattern can never blow up matching time (backreferences/lookarounds are
    /// rejected at construction).
    /// </summary>
    Regex,
}

/// <summary>
/// A single trigger of an <see cref="ICustomAnomalyDetector"/>: a literal phrase or a regular
/// expression that, when found in a new conversation turn, gates the detector's LLM review.
/// </summary>
public sealed record AnomalyTrigger(TriggerKind Kind, string Pattern);
