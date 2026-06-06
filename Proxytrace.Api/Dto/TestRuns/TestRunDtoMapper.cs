using System.Text.Json;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Api.Dto.TestRuns;

/// <summary>
/// Maps <see cref="ITestRun"/> domain entities and their fixtures to test-run DTOs.
/// Shared by the test-runs controller and the test-run-groups aggregate endpoint.
/// </summary>
public sealed class TestRunDtoMapper
{
    public TestRunDto ToDto(ITestRun r)
    {
        var passed = r.TestResults.Count(x => x.Evaluations.Count > 0 && x.Evaluations.All(e => e.Score >= EvaluationScore.Acceptable));
        var completed = r.TestResults.Count;
        var total = r.Group.Suite.TestCases.Count;
        var passRate = completed > 0 ? Math.Round((double)passed / completed * 100) : 0;
        long? durationMs = r.CompletedAt.HasValue
            ? (long)(r.CompletedAt.Value - r.CreatedAt).TotalMilliseconds
            : null;

        var totals = TestRunTotals.From(r);

        return new TestRunDto(
            Id: r.Id,
            GroupId: r.Group.Id,
            SuiteId: r.Group.Suite.Id,
            SuiteName: r.Group.Suite.Name,
            AgentId: r.Group.Suite.Agent.Id,
            AgentName: r.Group.Suite.Agent.Name,
            EndpointId: r.Endpoint.Id,
            EndpointName: r.Endpoint.Model.Name,
            Status: r.Status,
            TotalCases: total,
            PassedCases: passed,
            FailedCases: completed - passed,
            PassRate: passRate,
            CostUsd: (double?)totals.CostUsd,
            TokensIn: totals.TokensIn,
            TokensOut: totals.TokensOut,
            Evaluators: r.Group.Suite.Evaluators.Select(e => new RunEvaluatorDto(e.Id, e.Kind, e.Name)).ToArray(),
            StartedAt: r.CreatedAt,
            CompletedAt: r.CompletedAt,
            DurationMs: durationMs,
            TestCases: r.Group.Suite.TestCases.Select(tc => new TestCaseRowDto(tc.Id, tc.GetSummary())).ToArray(),
            Results: r.TestResults.Select(res => new TestResultDto(
                res.Id,
                res.TestCase.Id,
                res.TestCase.GetSummary(),
                res.ActualResponse.GetText(),
                res.Evaluations.Select(e => new EvaluationResultDto(
                    e.Evaluator.Id,
                    e.Evaluator.Kind,
                    e.Evaluator.Name,
                    e.Score,
                    e.Reasoning,
                    e.ErrorMessage)).ToArray(),
                (long)res.Latency.TotalMilliseconds
            )).ToArray(),
            CreatedAt: r.CreatedAt,
            UpdatedAt: r.UpdatedAt);
    }

    public TestCaseFixtureDto ToFixtureDto(ITestRun run, ITestResult result)
        => new(
            Input: new TestCaseInputDto(MapInputMessages(result.TestCase.Input)),
            Expected: MapOutput(result.TestCase.ExpectedOutput),
            Actual: MapOutput(result.ActualResponse),
            Evaluators: MapEvaluators(result.Evaluations),
            Runtime: MapRuntime(result),
            Endpoints: MapEndpoints(run, result));

    public ModelRequestPreviewDto ToRequestDto(ModelRequestPreview preview)
        => new(
            preview.Model,
            preview.Messages.Select(m => new RequestMessageDto(
                m.Role,
                m.Content,
                m.ToolCalls.Select(tc => new RequestToolCallDto(tc.Id, tc.Name, tc.Arguments)).ToArray(),
                m.ToolCallId)).ToArray(),
            preview.Tools.Select(t => new RequestToolDto(
                t.Name,
                t.Description,
                JsonSerializer.Deserialize<JsonElement>(t.JsonSchema))).ToArray());

    private TestCaseMessageDto[] MapInputMessages(Conversation input)
        => input.Messages.Select(MapInputMessage).ToArray();

    private static TestCaseMessageDto MapInputMessage(Message msg)
    {
        switch (msg)
        {
            case AssistantMessage assistant:
                var requests = assistant.ToolRequests
                    .Select(tr => new ToolRequestFixtureDto(tr.Id, tr.Name, tr.Arguments))
                    .ToArray();
                return new TestCaseMessageDto("assistant", assistant.GetText(), requests, null);
            case ToolMessage toolMsg:
                var (id, contents) = toolMsg.Deconstruct();
                var content = string.Concat(contents.Select(c => c.Text ?? ""));
                return new TestCaseMessageDto("tool", content, [], id);
            default:
                return new TestCaseMessageDto(msg.Role.ToString().ToLowerInvariant(), msg.GetText(), [], null);
        }
    }

    private OutputValueDto MapOutput(AssistantMessage msg)
    {
        var text = msg.GetText();
        var firstTool = msg.ToolRequests.FirstOrDefault();
        if (firstTool is not null && string.IsNullOrWhiteSpace(text))
        {
            var args = JsonSerializer.Deserialize<JsonElement>(firstTool.Arguments);
            return new OutputValueDto("tool_call", null, null, firstTool.Name, args);
        }
        ToolCallInfoDto? toolInfo = firstTool is not null
            ? new ToolCallInfoDto(firstTool.Name, JsonSerializer.Deserialize<JsonElement>(firstTool.Arguments))
            : null;
        return new OutputValueDto("message", text.Length > 0 ? text : null, toolInfo, null, null);
    }

    private EvaluatorFixtureResultDto[] MapEvaluators(IReadOnlyCollection<IEvaluation> evaluations)
        => evaluations.Select(eval => new EvaluatorFixtureResultDto(
            EvaluatorId: eval.Evaluator.Id.ToString(),
            EvaluatorKind: eval.Evaluator.Kind.ToString(),
            EvaluatorName: eval.Evaluator.Name,
            Score: eval.Score.HasValue ? (double)(int)eval.Score.Value : 0,
            Pass: eval.Passed,
            Breakdown: [],
            Note: eval.ErrorMessage ?? eval.Reasoning ?? string.Empty
        )).ToArray();

    private RuntimeBreakdownDto MapRuntime(ITestResult result)
    {
        var total = result.Latency.TotalMilliseconds;
        return new RuntimeBreakdownDto(Total: (long)total, Ttft: 0, Gen: (long)total, Tools: 0, Judge: null);
    }

    private EndpointUsageDto[] MapEndpoints(ITestRun run, ITestResult result) =>
    [
        new EndpointUsageDto(
            Id: run.Endpoint.Id.ToString(),
            Label: $"{run.Endpoint.Provider.Name} · {run.Endpoint.Model.Name}",
            Color: EndpointColor(run.Endpoint.Provider.Name),
            Region: "n/a",
            PricingIn: (double)(run.Endpoint.InputTokenCost ?? 0),
            PricingOut: (double)(run.Endpoint.OutputTokenCost ?? 0),
            TokIn: result.Usage?.InputTokenCount,
            TokOut: result.Usage?.OutputTokenCount,
            Calls: 1,
            Latency: (long)result.Latency.TotalMilliseconds,
            CostUsd: result.Usage is { } usage ? (double)(run.Endpoint.CalculateCost(usage) ?? 0m) : 0)
    ];

    private string EndpointColor(string providerName)
    {
        var lower = providerName.ToLowerInvariant();
        if (lower.Contains("openai")) return "#10a37f";
        if (lower.Contains("azure")) return "#3b82f6";
        return lower.Contains("anthropic") ? "#d97757" : "#8b5cf6";
    }
}
