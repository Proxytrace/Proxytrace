using System.Text.Json;
using BenchmarkDotNet.Running;
using Proxytrace.Benchmarks;

// Run the benchmarks, then check each mean against the shared budgets file and exit non-zero on a breach.
string budgetsPath = ArgValue(args, "--budgets") ?? "perf/perf-budgets.json";
string outPath = ArgValue(args, "--out") ?? "perf/results/benchmarks.json";

var summary = BenchmarkRunner.Run<SerializationBenchmarks>();

Dictionary<string, double> budgets = LoadBenchmarkBudgets(budgetsPath);

var rows = new List<object>();
bool allPassed = true;

Console.WriteLine();
Console.WriteLine($"{"BENCHMARK",-28} {"MEAN (µs)",12} {"BUDGET (µs)",12}  STATUS");
Console.WriteLine(new string('-', 70));

foreach (var report in summary.Reports)
{
    string name = report.BenchmarkCase.Descriptor.WorkloadMethod.Name;
    double? meanUs = report.ResultStatistics is { } stats ? stats.Mean / 1000.0 : null;
    double? budget = budgets.TryGetValue(Camel(name), out double b) ? b : null;

    bool pass = budget is null || (meanUs is not null && meanUs.Value <= budget.Value);
    if (!pass) allPassed = false;

    string status = budget is null ? "(no budget)" : pass ? "PASS" : "FAIL";
    Console.WriteLine($"{name,-28} {meanUs,12:N2} {(budget?.ToString("N2") ?? "—"),12}  {status}");

    rows.Add(new { name, meanUs, budgetUs = budget, pass });
}

Console.WriteLine(new string('-', 70));
Console.WriteLine(allPassed ? "RESULT: PASS" : "RESULT: FAIL (budget breached)");

Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outPath))!);
await File.WriteAllTextAsync(outPath,
    JsonSerializer.Serialize(new { allPassed, benchmarks = rows }, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"[report] wrote {outPath}");

return allPassed ? 0 : 2;

static string? ArgValue(string[] args, string name)
{
    int i = Array.IndexOf(args, name);
    return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
}

// "ConversationSerialize" -> "conversationSerialize" to match the JSON budget keys.
static string Camel(string name) => string.IsNullOrEmpty(name) ? name : char.ToLowerInvariant(name[0]) + name[1..];

static Dictionary<string, double> LoadBenchmarkBudgets(string path)
{
    if (!File.Exists(path))
    {
        return new Dictionary<string, double>();
    }

    using var doc = JsonDocument.Parse(File.ReadAllText(path),
        new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip });
    if (!doc.RootElement.TryGetProperty("benchmarkMeanUs", out var node))
    {
        return new Dictionary<string, double>();
    }

    var result = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
    foreach (var prop in node.EnumerateObject())
    {
        result[prop.Name] = prop.Value.GetDouble();
    }
    return result;
}
