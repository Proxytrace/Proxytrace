using AwesomeAssertions;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class TokenUsageTests
{
    [TestMethod]
    public void Minus_SubtractsPerTokenKind()
    {
        var a = new TokenUsage(100, 50, 20);
        var b = new TokenUsage(40, 10, 5);

        var result = a - b;

        result.Should().Be(new TokenUsage(60, 40, 15));
    }

    [TestMethod]
    public void Minus_LargerSubtrahend_ClampsAtZero()
    {
        var a = new TokenUsage(10, 10, 10);
        var b = new TokenUsage(20, 5, 30);

        var result = a - b;

        result.Should().Be(new TokenUsage(0, 5, 0));
    }

    [TestMethod]
    public void Minus_WithNullOperand_ReturnsNull()
    {
        // Regression: `null - b` used to return b itself as the "difference".
        var usage = new TokenUsage(100, 50, 20);

        (null - usage).Should().BeNull();
        (usage - null).Should().BeNull();
        ((TokenUsage?)null - null).Should().BeNull();
    }

    [TestMethod]
    public void Plus_WithNullOperand_ReturnsOther()
    {
        var usage = new TokenUsage(100, 50, 20);

        (null + usage).Should().Be(usage);
        (usage + null).Should().Be(usage);
    }
}
