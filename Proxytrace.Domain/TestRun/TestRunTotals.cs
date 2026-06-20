using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.TestRun;

/// <summary>
/// Aggregated token usage and cost across the test results of an <see cref="ITestRun"/>.
/// </summary>
public record TestRunTotals(decimal? CostUsd, long? TokensIn, long? TokensOut, long? CachedTokensIn)
{
    public static TestRunTotals From(ITestRun run)
    {
        var usages = run.TestResults
            .Select(r => r.Usage)
            .OfType<TokenUsage>()
            .ToArray();
        if (usages.Length == 0)
            return new TestRunTotals(null, null, null, null);

        ulong tokensIn = 0;
        ulong tokensOut = 0;
        ulong cachedTokensIn = 0;
        foreach (var usage in usages)
        {
            tokensIn += usage.InputTokenCount;
            tokensOut += usage.OutputTokenCount;
            cachedTokensIn += usage.CachedInputTokenCount;
        }

        var cost = run.Endpoint.CalculateCost(new TokenUsage(tokensIn, tokensOut, cachedTokensIn));
        return new TestRunTotals(cost, (long)tokensIn, (long)tokensOut, (long)cachedTokensIn);
    }
}
