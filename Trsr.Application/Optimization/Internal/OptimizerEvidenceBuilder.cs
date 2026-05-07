using System.Text.Json;
using Trsr.Domain.Agent;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;

namespace Trsr.Application.Optimization.Internal;

internal sealed record OptimizerEvidence(
    IReadOnlyList<ITestResult> Failing,
    IReadOnlyList<ITestResult> PassingSample);

internal static class OptimizerEvidenceBuilder
{
    public const int MaxFailing = 20;
    public const int PassingSampleSize = 3;

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public static OptimizerEvidence Build(ITestRun run)
    {
        var failing = run.TestResults
            .Where(r => !r.Passed)
            .OrderBy(r => (int?)r.OverallScore ?? 0)
            .ThenBy(r => r.Id)
            .Take(MaxFailing)
            .ToList();

        var passingSample = run.TestResults
            .Where(r => r.Passed)
            .OrderBy(r => r.Id)
            .Take(PassingSampleSize)
            .ToList();

        return new OptimizerEvidence(failing, passingSample);
    }

    public static string RenderToJson(IAgent agent, OptimizerEvidence evidence)
    {
        var payload = new
        {
            agent = new
            {
                name = agent.Name,
                system_prompt = agent.SystemPrompt.Template,
                tools = agent.Tools.Select(ToToolPayload).ToArray(),
            },
            failing = evidence.Failing.Select(ToResultPayload).ToArray(),
            passing = evidence.PassingSample.Select(ToResultPayload).ToArray(),
        };

        return JsonSerializer.Serialize(payload, SerializerOptions);
    }

    private static object ToToolPayload(Domain.Tools.ToolSpecification tool)
    {
        using var doc = TryParseJson(tool.Arguments.JsonSchema);
        return new
        {
            name = tool.Name,
            description = tool.Description,
            parameters = doc is not null
                ? JsonSerializer.Deserialize<JsonElement>(tool.Arguments.JsonSchema)
                : (object?)null,
        };
    }

    private static object ToResultPayload(ITestResult result)
    {
        return new
        {
            input = result.TestCase.Input.Messages,
            expected = result.TestCase.ExpectedOutput,
            actual = result.ActualResponse,
            passed = result.Passed,
            overall_score = result.OverallScore?.ToString(),
            evaluations = result.Evaluations.Select(e => new
            {
                evaluator = e.Evaluator.Kind.ToString(),
                score = e.Score.ToString(),
                passed = e.Passed,
                reasoning = e.Reasoning,
            }).ToArray(),
        };
    }

    private static JsonDocument? TryParseJson(string raw)
    {
        try
        {
            return JsonDocument.Parse(raw);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
