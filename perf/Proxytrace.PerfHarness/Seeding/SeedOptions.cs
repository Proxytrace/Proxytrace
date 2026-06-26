namespace Proxytrace.PerfHarness.Seeding;

/// <summary>Shape of the dataset the perf seeder builds.</summary>
internal sealed record SeedOptions(
    long TargetCalls = 1_000_000,
    int AgentCount = 50,
    int EndpointCount = 10,
    int DaysSpread = 90,
    double ErrorRate = 0.05,
    double ConversationRate = 0.30,
    int BatchSize = 10_000,
    int RandomSeed = 1234)
{
    public static SeedOptions ForSize(long targetCalls) => new() { TargetCalls = targetCalls };
}

/// <summary>What the seeder produced — captured so scenarios can target real ids without re-querying.</summary>
internal sealed record SeedSummary(
    Guid ProjectId,
    Guid ProviderId,
    IReadOnlyList<Guid> AgentIds,
    IReadOnlyList<Guid> EndpointIds,
    long CallsInserted,
    TimeSpan Elapsed);
