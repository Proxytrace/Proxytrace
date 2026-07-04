using AwesomeAssertions;
using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class TriggerMatcherTests
{
    [TestMethod]
    public void FindFirstMatch_PhraseWithDifferentCasing_Matches()
    {
        var trigger = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        var match = TriggerMatcher.FindFirstMatch("Please REFUND me right now.", [trigger]);

        match.Should().NotBeNull();
        match.Trigger.Should().Be(trigger);
        match.Excerpt.Should().Be("REFUND");
    }

    [TestMethod]
    public void FindFirstMatch_RegexWithDifferentCasing_MatchesAndReturnsExcerpt()
    {
        var trigger = new AnomalyTrigger(TriggerKind.Regex, @"refund(ed)?");

        var match = TriggerMatcher.FindFirstMatch("Your order was Refunded yesterday.", [trigger]);

        match.Should().NotBeNull();
        match.Trigger.Should().Be(trigger);
        match.Excerpt.Should().Be("Refunded");
    }

    [TestMethod]
    public void FindFirstMatch_InvalidRegexTrigger_IsIsolatedFromOtherTriggers()
    {
        // Backreferences are rejected by NonBacktracking at construction; the malformed bracket
        // pattern fails plain parsing. Neither may throw or shadow the later valid trigger.
        var invalidBackreference = new AnomalyTrigger(TriggerKind.Regex, @"(a)\1");
        var invalidSyntax = new AnomalyTrigger(TriggerKind.Regex, "[unclosed");
        var valid = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        var match = TriggerMatcher.FindFirstMatch(
            "aa refund", [invalidBackreference, invalidSyntax, valid]);

        match.Should().NotBeNull();
        match.Trigger.Should().Be(valid);
    }

    [TestMethod]
    public void FindFirstMatch_MultipleMatchingTriggers_ReturnsFirstInTriggerOrder()
    {
        var first = new AnomalyTrigger(TriggerKind.Phrase, "hello");
        var second = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        var match = TriggerMatcher.FindFirstMatch("refund me, hello", [first, second]);

        match.Should().NotBeNull();
        match.Trigger.Should().Be(first);
    }

    [TestMethod]
    public void FindFirstMatch_NoTriggerMatches_ReturnsNull()
    {
        var match = TriggerMatcher.FindFirstMatch(
            "All good here.",
            [new AnomalyTrigger(TriggerKind.Phrase, "refund"), new AnomalyTrigger(TriggerKind.Regex, "angry")]);

        match.Should().BeNull();
    }

    [TestMethod]
    public void FindFirstMatch_EmptyText_ReturnsNull()
    {
        var match = TriggerMatcher.FindFirstMatch(
            "", [new AnomalyTrigger(TriggerKind.Phrase, "refund")]);

        match.Should().BeNull();
    }

    [TestMethod]
    public void FindFirstMatch_EmptyTriggerPattern_IsSkipped()
    {
        var empty = new AnomalyTrigger(TriggerKind.Phrase, "");
        var valid = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        var match = TriggerMatcher.FindFirstMatch("refund", [empty, valid]);

        match.Should().NotBeNull();
        match.Trigger.Should().Be(valid);
    }

    [TestMethod]
    public void FindFirstMatch_SameRegexRepeatedly_KeepsMatchingViaCachedCompilation()
    {
        // The proxy hot path evaluates the same patterns per request; the compiled-regex cache
        // must be transparent — repeated evaluation returns the same result every time.
        var trigger = new AnomalyTrigger(TriggerKind.Regex, @"pass(word)?\s*[:=]");

        for (var i = 0; i < 3; i++)
        {
            var match = TriggerMatcher.FindFirstMatch("my password: hunter2", [trigger]);
            match.Should().NotBeNull();
            match.Excerpt.Should().Be("password:");
        }
    }

    [TestMethod]
    public void FindFirstMatch_ManyDistinctRegexes_SurvivesCacheOverflow()
    {
        // More distinct patterns than the bounded cache holds — the overflow drop must be
        // invisible to callers.
        for (var i = 0; i < 300; i++)
        {
            var trigger = new AnomalyTrigger(TriggerKind.Regex, $"pattern-{i}-[0-9]+");
            var match = TriggerMatcher.FindFirstMatch($"xx pattern-{i}-42 yy", [trigger]);
            match.Should().NotBeNull();
        }
    }

    [TestMethod]
    public void FindFirstMatch_RegexOnHugeInput_CompletesWithinTimeoutGuard()
    {
        // NonBacktracking matching is linear and the matcher carries a hard 100 ms timeout that is
        // swallowed per trigger — a pathological input must never throw out of the matcher.
        var text = new string('a', 1_000_000) + " refund";
        var regex = new AnomalyTrigger(TriggerKind.Regex, "(a+)+refund");
        var fallback = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        var act = () => TriggerMatcher.FindFirstMatch(text, [regex, fallback]);

        act.Should().NotThrow().Which.Should().NotBeNull();
    }
}
