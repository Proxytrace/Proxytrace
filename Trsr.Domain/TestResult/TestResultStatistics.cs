using Trsr.Domain.Completion;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Usage;

namespace Trsr.Domain.TestResult;

public record TestResultStatistics(
    TokenUsage? Usage,
    TimeSpan Latency)
{
    internal static TestResultStatistics FromCompletion(ICompletion completion)
        => new(
            Usage: completion.Usage,
            Latency: completion.Latency);
}