using System.Text.RegularExpressions;
using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Application.CustomAnomaly;

/// <summary>
/// A trigger hit: the trigger that fired and the excerpt of the turn text it matched.
/// </summary>
public sealed record TriggerMatch(AnomalyTrigger Trigger, string Excerpt);

/// <summary>
/// Pure trigger matching for the custom-anomaly review pipeline: given a conversation turn's text
/// and a detector's triggers, returns the first match (in trigger order) or <see langword="null"/>.
/// Phrases match by case-insensitive containment; regexes compile with
/// <c>IgnoreCase | NonBacktracking</c> and a hard match timeout. A single bad trigger (invalid
/// pattern, timeout) is skipped so it can never break the detector's other triggers.
/// </summary>
public static class TriggerMatcher
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    public static TriggerMatch? FindFirstMatch(string text, IReadOnlyList<AnomalyTrigger> triggers)
    {
        if (string.IsNullOrEmpty(text))
            return null;

        foreach (var trigger in triggers)
        {
            if (string.IsNullOrEmpty(trigger.Pattern))
                continue;

            var excerpt = trigger.Kind switch
            {
                TriggerKind.Phrase => MatchPhrase(text, trigger.Pattern),
                TriggerKind.Regex => MatchRegex(text, trigger.Pattern),
                _ => null,
            };

            if (excerpt is not null)
                return new TriggerMatch(trigger, excerpt);
        }

        return null;
    }

    private static string? MatchPhrase(string text, string phrase)
    {
        int index = text.IndexOf(phrase, StringComparison.OrdinalIgnoreCase);
        return index < 0 ? null : text.Substring(index, phrase.Length);
    }

    private static string? MatchRegex(string text, string pattern)
    {
        try
        {
            var regex = new Regex(pattern, RegexOptions.IgnoreCase | RegexOptions.NonBacktracking, RegexTimeout);
            var match = regex.Match(text);
            return match.Success ? match.Value : null;
        }
        // Invalid pattern — ArgumentException (RegexParseException) for malformed patterns,
        // NotSupportedException for constructs NonBacktracking rejects (backreferences,
        // lookarounds). Validation should have rejected it, but a bad trigger must never break
        // the others.
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException)
        {
            return null;
        }
        catch (RegexMatchTimeoutException)
        {
            return null;
        }
    }
}
