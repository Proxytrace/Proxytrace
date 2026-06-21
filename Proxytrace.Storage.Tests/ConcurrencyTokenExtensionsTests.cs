using AwesomeAssertions;
using Proxytrace.Storage.Internal;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class ConcurrencyTokenExtensionsTests
{
    [TestMethod]
    public void MatchesConcurrencyToken_IdenticalValues_Match()
    {
        var value = DateTimeOffset.UtcNow;
        value.MatchesConcurrencyToken(value).Should().BeTrue();
    }

    [TestMethod]
    public void MatchesConcurrencyToken_SubMicrosecondDifference_Match()
    {
        // The in-memory token (full 100ns precision) vs the same instant truncated to microseconds
        // by Postgres — these must be treated as the same version.
        var microsecondAligned = new DateTimeOffset(
            DateTimeOffset.UtcNow.UtcTicks / TimeSpan.TicksPerMicrosecond * TimeSpan.TicksPerMicrosecond,
            TimeSpan.Zero);
        var withSubMicrosecond = microsecondAligned.AddTicks(7); // +700ns, below microsecond precision

        microsecondAligned.MatchesConcurrencyToken(withSubMicrosecond).Should().BeTrue();
        withSubMicrosecond.MatchesConcurrencyToken(microsecondAligned).Should().BeTrue();
    }

    [TestMethod]
    public void MatchesConcurrencyToken_OneMicrosecondDifference_DoesNotMatch()
    {
        // A genuine newer version differs by at least a microsecond, so it must be detected.
        var value = new DateTimeOffset(
            DateTimeOffset.UtcNow.UtcTicks / TimeSpan.TicksPerMicrosecond * TimeSpan.TicksPerMicrosecond,
            TimeSpan.Zero);
        var oneMicrosecondLater = value.AddTicks(TimeSpan.TicksPerMicrosecond);

        value.MatchesConcurrencyToken(oneMicrosecondLater).Should().BeFalse();
    }

    [TestMethod]
    public void MatchesConcurrencyToken_DifferentOffsetsSameInstant_Match()
    {
        // The token compares the instant, not the wall-clock representation.
        var utc = new DateTimeOffset(2026, 6, 6, 12, 0, 0, TimeSpan.Zero);
        var sameInstantOtherOffset = utc.ToOffset(TimeSpan.FromHours(2));

        utc.MatchesConcurrencyToken(sameInstantOtherOffset).Should().BeTrue();
    }

    [TestMethod]
    public void TruncateToMicroseconds_DropsSubMicrosecondTicks()
    {
        var microsecondAligned = new DateTimeOffset(
            DateTimeOffset.UtcNow.UtcTicks / TimeSpan.TicksPerMicrosecond * TimeSpan.TicksPerMicrosecond,
            TimeSpan.Zero);
        var withSubMicrosecond = microsecondAligned.AddTicks(7); // +700ns, below microsecond precision

        withSubMicrosecond.TruncateToMicroseconds().Should().Be(microsecondAligned);
    }

    [TestMethod]
    public void TruncateToMicroseconds_AlreadyAligned_IsUnchanged()
    {
        var microsecondAligned = new DateTimeOffset(
            DateTimeOffset.UtcNow.UtcTicks / TimeSpan.TicksPerMicrosecond * TimeSpan.TicksPerMicrosecond,
            TimeSpan.Zero);

        microsecondAligned.TruncateToMicroseconds().Should().Be(microsecondAligned);
    }

    [TestMethod]
    public void TruncateToMicroseconds_NormalisesToUtc()
    {
        // The truncated token is always expressed at +00:00 — it is compared by instant, and the
        // database persists UTC.
        var withOffset = new DateTimeOffset(2026, 6, 6, 14, 0, 0, TimeSpan.FromHours(2));

        withOffset.TruncateToMicroseconds().Offset.Should().Be(TimeSpan.Zero);
        withOffset.TruncateToMicroseconds().Should().Be(withOffset.ToUniversalTime());
    }

    [TestMethod]
    public void TruncateToMicroseconds_ResultMatchesOriginalToken()
    {
        // Truncating must never make a token look like a different version of itself.
        var value = DateTimeOffset.UtcNow;

        value.MatchesConcurrencyToken(value.TruncateToMicroseconds()).Should().BeTrue();
    }
}
