using System.Text.Json;
using System.Text.Json.Serialization;

namespace Proxytrace.PerfHarness.Reporting;

/// <summary>
/// Absolute budgets loaded from <c>perf/perf-budgets.json</c> — the single source of truth shared by
/// every scope. A missing entry means "no budget" (the metric is measured and reported but never fails
/// the run), so adding a new scenario does not require touching the budgets file before it can run.
/// </summary>
internal sealed class PerfBudgets
{
    public IngestionBudget Ingestion { get; init; } = new();
    public Dictionary<string, double> DbQueryP95Ms { get; init; } = new();
    public Dictionary<string, double> HttpP95Ms { get; init; } = new();
    public Dictionary<string, double> BenchmarkMeanUs { get; init; } = new();

    public double? DbQueryBudget(string name)
        => DbQueryP95Ms.TryGetValue(name, out double v) ? v : null;

    public sealed class IngestionBudget
    {
        public double CallsPerSecMin { get; init; }
    }

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static async Task<PerfBudgets> LoadAsync(string path, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<PerfBudgets>(stream, Options, cancellationToken)
               ?? new PerfBudgets();
    }
}
