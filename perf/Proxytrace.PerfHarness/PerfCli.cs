using Proxytrace.PerfHarness.Bootstrap;
using Proxytrace.PerfHarness.Reporting;
using Proxytrace.PerfHarness.Scenarios;
using Proxytrace.PerfHarness.Seeding;

namespace Proxytrace.PerfHarness;

/// <summary>
/// Entry point for the DB-layer perf harness.
/// <code>
///   seed       --size N                          bulk-load ~N agent calls into Postgres
///   db-layer   [--warmup W --iterations I ...]   measure ingestion throughput + query latency
///   all        --size N                          seed, then db-layer
/// </code>
/// Connection string comes from <c>--connection</c> or <c>PROXYTRACE_PERF_CONNECTION</c>. A run exits
/// non-zero when any measured metric breaches its budget in <c>perf/perf-budgets.json</c>.
/// </summary>
internal static class PerfCli
{
    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("usage: perf-harness <seed|db-layer|all> [--size N] [--connection <cs>] [--budgets <path>] [--out <path>]");
            return 1;
        }

        string command = args[0];
        string connection = ResolveConnection(args);
        long size = GetLong(args, "--size", 1_000_000);
        string budgetsPath = GetString(args, "--budgets") ?? "perf/perf-budgets.json";
        string outPath = GetString(args, "--out") ?? "perf/results/db-layer.json";

        int warmup = (int)GetLong(args, "--warmup", 2);
        int iterations = (int)GetLong(args, "--iterations", 10);
        long ingestCount = GetLong(args, "--ingest-count", 5_000);
        int ingestConcurrency = (int)GetLong(args, "--ingest-concurrency", 8);

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

        await using var container = PerfContainer.Build(connection);

        try
        {
            switch (command)
            {
                case "seed":
                    await SeedAsync(container, connection, size, cts.Token);
                    return 0;

                case "db-layer":
                    return await DbLayerAsync(container, budgetsPath, outPath, warmup, iterations, ingestCount, ingestConcurrency, cts.Token);

                case "all":
                    await SeedAsync(container, connection, size, cts.Token);
                    return await DbLayerAsync(container, budgetsPath, outPath, warmup, iterations, ingestCount, ingestConcurrency, cts.Token);

                default:
                    Console.Error.WriteLine($"unknown command: {command}");
                    return 1;
            }
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("cancelled.");
            return 130;
        }
    }

    private static async Task SeedAsync(PerfContainer container, string connection, long size, CancellationToken cancellationToken)
    {
        await container.ApplyMigrationsAsync(cancellationToken);
        var seeder = new PerfDataSeeder(container);
        await seeder.SeedAsync(SeedOptions.ForSize(size), cancellationToken);
        await AnalyzeAsync(connection, cancellationToken);
    }

    /// <summary>
    /// Refreshes planner statistics after the bulk load. PostgreSQL leaves a freshly bulk-inserted
    /// table with no stats until autovacuum catches up, and the planner then defaults to wildly low
    /// row estimates — turning the statistics aggregates into a nested-loop plan that random-reads the
    /// whole table (seconds at 1M rows) instead of a parallel seq-scan aggregate (sub-second). A
    /// production database accrues rows incrementally and autovacuum keeps its stats current; the
    /// harness bulk-loads in one shot, so it must ANALYZE explicitly to measure the steady-state plan
    /// the product actually runs rather than a cold-load artifact (issue #246).
    /// </summary>
    private static async Task AnalyzeAsync(string connection, CancellationToken cancellationToken)
    {
        Console.WriteLine("[seed] ANALYZE (refresh planner statistics after bulk load)…");
        await using var conn = new Npgsql.NpgsqlConnection(connection);
        await conn.OpenAsync(cancellationToken);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "ANALYZE";
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<int> DbLayerAsync(
        PerfContainer container,
        string budgetsPath,
        string outPath,
        int warmup,
        int iterations,
        long ingestCount,
        int ingestConcurrency,
        CancellationToken cancellationToken)
    {
        await container.ApplyMigrationsAsync(cancellationToken);
        var budgets = await PerfBudgets.LoadAsync(budgetsPath, cancellationToken);
        var report = new PerfReport();

        var queryResults = await QueryLatencyScenario.RunAsync(container, budgets, warmup, iterations, cancellationToken);
        report.AddRange(queryResults);

        var runStatsResults = await TestRunStatsQueryScenario.RunAsync(container, budgets, warmup, iterations, cancellationToken);
        report.AddRange(runStatsResults);

        var ingestionResult = await IngestionThroughputScenario.RunAsync(container, budgets, ingestCount, ingestConcurrency, cancellationToken);
        report.Add(ingestionResult);

        report.PrintTable();
        await report.WriteJsonAsync(outPath, cancellationToken);

        return report.AllPassed ? 0 : 2;
    }

    private static string ResolveConnection(string[] args)
    {
        string? fromArg = GetString(args, "--connection");
        if (!string.IsNullOrWhiteSpace(fromArg))
        {
            return fromArg;
        }

        string? fromEnv = Environment.GetEnvironmentVariable("PROXYTRACE_PERF_CONNECTION");
        return string.IsNullOrWhiteSpace(fromEnv)
            ? "Host=localhost;Port=5433;Database=proxytrace_perf;Username=proxytrace;Password=proxytrace"
            : fromEnv;
    }

    private static string? GetString(string[] args, string name)
    {
        int idx = Array.IndexOf(args, name);
        return idx >= 0 && idx + 1 < args.Length ? args[idx + 1] : null;
    }

    private static long GetLong(string[] args, string name, long fallback)
    {
        string? raw = GetString(args, name)?.Replace("_", "").Replace(",", "");
        return long.TryParse(raw, out long value) ? value : fallback;
    }
}
