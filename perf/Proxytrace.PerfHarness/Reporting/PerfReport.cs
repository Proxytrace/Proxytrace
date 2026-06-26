using System.Diagnostics;
using System.Text.Json;

namespace Proxytrace.PerfHarness.Reporting;

internal enum BudgetDirection
{
    /// <summary>Latency-style metric: measured must be ≤ budget.</summary>
    LowerIsBetter,

    /// <summary>Throughput-style metric: measured must be ≥ budget.</summary>
    HigherIsBetter,
}

/// <summary>One measured metric and its verdict against the (optional) budget.</summary>
internal sealed record MetricResult(
    string Scope,
    string Name,
    double Measured,
    double? Budget,
    string Unit,
    BudgetDirection Direction)
{
    public bool Pass => Budget is null
        || (Direction == BudgetDirection.LowerIsBetter ? Measured <= Budget.Value : Measured >= Budget.Value);
}

/// <summary>
/// Collects metric results, prints a human table, writes a machine-readable JSON file, and decides the
/// process exit code: a run fails when any metric with a budget breaches it.
/// </summary>
internal sealed class PerfReport
{
    private readonly List<MetricResult> results = new();

    public void Add(MetricResult result) => results.Add(result);

    public void AddRange(IEnumerable<MetricResult> items) => results.AddRange(items);

    public bool AllPassed => results.All(r => r.Pass);

    public void PrintTable()
    {
        Console.WriteLine();
        Console.WriteLine($"{"SCOPE",-12} {"METRIC",-30} {"MEASURED",14} {"BUDGET",14}  STATUS");
        Console.WriteLine(new string('-', 90));
        foreach (var r in results)
        {
            string measured = $"{r.Measured:N1} {r.Unit}";
            string budget = r.Budget is null ? "—" : $"{r.Budget.Value:N1} {r.Unit}";
            string status = r.Budget is null ? "(no budget)" : r.Pass ? "PASS" : "FAIL";
            Console.WriteLine($"{r.Scope,-12} {r.Name,-30} {measured,14} {budget,14}  {status}");
        }
        Console.WriteLine(new string('-', 90));
        Console.WriteLine(AllPassed ? "RESULT: PASS" : "RESULT: FAIL (budget breached)");
        Console.WriteLine();
    }

    public async Task WriteJsonAsync(string path, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var payload = new
        {
            allPassed = AllPassed,
            metrics = results.Select(r => new
            {
                scope = r.Scope,
                name = r.Name,
                measured = r.Measured,
                budget = r.Budget,
                unit = r.Unit,
                direction = r.Direction.ToString(),
                pass = r.Pass,
            }),
        };

        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, payload,
            new JsonSerializerOptions { WriteIndented = true }, cancellationToken);
        Console.WriteLine($"[report] wrote {path}");
    }

    /// <summary>Runs warmup then timed iterations of <paramref name="action"/> and returns its p50/p95 in ms.</summary>
    public static async Task<(double P50Ms, double P95Ms)> MeasureLatencyAsync(
        int warmup, int iterations, Func<Task> action)
    {
        for (int i = 0; i < warmup; i++)
        {
            await action();
        }

        var durations = new double[iterations];
        for (int i = 0; i < iterations; i++)
        {
            var sw = Stopwatch.StartNew();
            await action();
            sw.Stop();
            durations[i] = sw.Elapsed.TotalMilliseconds;
        }

        Array.Sort(durations);
        return (Percentile(durations, 0.50), Percentile(durations, 0.95));
    }

    private static double Percentile(double[] sortedAscending, double percentile)
    {
        if (sortedAscending.Length == 0)
        {
            return 0;
        }

        int rank = (int)Math.Ceiling(percentile * sortedAscending.Length);
        int index = Math.Clamp(rank - 1, 0, sortedAscending.Length - 1);
        return sortedAscending[index];
    }
}
