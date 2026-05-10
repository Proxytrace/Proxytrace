using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestRuns;
using Trsr.Application.Streaming;
using Trsr.Domain;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.TestRun;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/test-runs")]
public class TestRunsController : ControllerBase
{
    private static readonly JsonSerializerOptions SseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ITestRunRepository repository;
    private readonly ITestResultBroadcaster broadcaster;

    public TestRunsController(
        ITestRunRepository repository,
        ITestResultBroadcaster broadcaster)
    {
        this.repository = repository;
        this.broadcaster = broadcaster;
    }

    [HttpGet]
    public async Task<PagedResult<TestRunDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = agentId.HasValue
            ? await repository.GetByAgentAsync(agentId.Value, cancellationToken)
            : await repository.GetAllAsync(cancellationToken);
        var items = all
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToDto)
            .ToArray();
        return new PagedResult<TestRunDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestRunDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var run = await repository.GetAsync(id, cancellationToken);
        return ToDto(run);
    }

    [HttpGet("{id:guid}/cases/{caseId:guid}/fixture")]
    public async Task<ActionResult<TestCaseFixtureDto>> GetCaseFixture(
        Guid id, Guid caseId, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var run = await repository.GetAsync(id, cancellationToken);
        var result = run.TestResults.FirstOrDefault(r => r.TestCase.Id == caseId);
        if (result is null)
            return NotFound();
        return ToFixtureDto(run, result);
    }

    [HttpGet("{id:guid}/stream")]
    public async Task Stream(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = broadcaster.Subscribe(id, cancellationToken);

        var run = await repository.GetAsync(id, cancellationToken);
        if (run.Status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled)
        {
            var completeEvt = RunCompleteEvent.Create(run);
            var completeData = JsonSerializer.Serialize(completeEvt, completeEvt.GetType(), SseOptions);
            await Response.WriteAsync($"event: run-complete\ndata: {completeData}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
            return;
        }

        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            await WriteEventAsync(evt, cancellationToken);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private async Task WriteEventAsync(TestRunEvent evt, CancellationToken cancellationToken)
    {
        var eventName = evt switch
        {
            TestCaseStartedEvent => "test-case-started",
            InferenceDoneEvent => "inference-done",
            EvaluationArrivedEvent => "evaluation-arrived",
            TestResultArrivedEvent => "test-result-arrived",
            RunCompleteEvent => "run-complete",
            _ => "unknown",
        };
        var data = JsonSerializer.Serialize(evt, evt.GetType(), SseOptions);
        await Response.WriteAsync($"event: {eventName}\ndata: {data}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    internal static TestRunDto ToDto(ITestRun r)
    {
        var passed = r.TestResults.Count(x => x.Evaluations.Count > 0 && x.Evaluations.All(e => e.Score >= EvaluationScore.Acceptable));
        var completed = r.TestResults.Count;
        var total = r.Group.Suite.TestCases.Count;
        var passRate = completed > 0 ? Math.Round((double)passed / completed * 100) : 0;
        long? durationMs = r.CompletedAt.HasValue
            ? (long)(r.CompletedAt.Value - r.CreatedAt).TotalMilliseconds
            : null;

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
            Evaluators: r.Group.Suite.Evaluators.Select(e => new RunEvaluatorDto(e.Id, e.Kind, e.Name)).ToArray(),
            StartedAt: r.CreatedAt,
            CompletedAt: r.CompletedAt,
            DurationMs: durationMs,
            TestCases: r.Group.Suite.TestCases.Select(tc => new TestCaseRowDto(tc.Id, SummarizeTestCase(tc))).ToArray(),
            Results: r.TestResults.Select(res => new TestResultDto(
                res.Id,
                res.TestCase.Id,
                SummarizeTestCase(res.TestCase),
                string.Concat(res.ActualResponse.Contents.Select(c => c.Text ?? "")),
                res.Evaluations.Select(e => new EvaluationResultDto(
                    e.Evaluator.Id,
                    e.Evaluator.Kind,
                    e.Evaluator.Name,
                    e.Score,
                    e.Reasoning)).ToArray(),
                (long)res.Latency.TotalMilliseconds
            )).ToArray(),
            CreatedAt: r.CreatedAt,
            UpdatedAt: r.UpdatedAt);
    }
    
    private static string SummarizeTestCase(Domain.TestCase.ITestCase tc)
    {
        var firstUserMessage = tc.Input.Messages
            .OfType<UserMessage>()
            .FirstOrDefault();
        if (firstUserMessage is null) return "Test case";
        var text = string.Concat(firstUserMessage.Contents.Select(c => c.Text ?? ""));
        return text.Length > 80 ? text[..77] + "…" : text;
    }

    private static TestCaseFixtureDto ToFixtureDto(ITestRun run, Domain.TestResult.ITestResult result)
        => new(
            Input: new TestCaseInputDto(MapInputMessages(result.TestCase.Input)),
            Expected: MapOutput(result.TestCase.ExpectedOutput),
            Actual: MapOutput(result.ActualResponse),
            Evaluators: MapEvaluators(result.Evaluations),
            Runtime: MapRuntime(result),
            Endpoints: MapEndpoints(run, result)
        );

    private static TestCaseMessageDto[] MapInputMessages(Conversation input)
        => input.Messages.Select(msg =>
        {
            var role = msg.Role.ToString().ToLowerInvariant();
            if (msg is ToolMessage toolMsg)
            {
                var (id, contents) = toolMsg.Deconstruct();
                var content = string.Concat(contents.Select(c => c.Text ?? ""));
                return new TestCaseMessageDto(role, content, id);
            }
            var text = string.Concat(msg.Contents.Select(c => c.Text ?? ""));
            return new TestCaseMessageDto(role, text, null);
        }).ToArray();

    private static OutputValueDto MapOutput(AssistantMessage msg)
    {
        var text = string.Concat(msg.Contents.Select(c => c.Text ?? ""));
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

    private static EvaluatorFixtureResultDto[] MapEvaluators(IReadOnlyCollection<IEvaluation> evaluations)
        => evaluations.Select(eval => new EvaluatorFixtureResultDto(
            EvaluatorId: eval.Evaluator.Id.ToString(),
            EvaluatorKind: eval.Evaluator.Kind.ToString(),
            EvaluatorName: eval.Evaluator.Name,
            Score: EvaluationScoreToFloat(eval.Score),
            Pass: eval.Score >= EvaluationScore.Acceptable,
            Breakdown: [],
            Note: eval.Reasoning ?? string.Empty
        )).ToArray();

    private static RuntimeBreakdownDto MapRuntime(Domain.TestResult.ITestResult result)
    {
        var total = result.Latency.TotalMilliseconds;
        return new RuntimeBreakdownDto(Total: (long)total, Ttft: 0, Gen: (long)total, Tools: 0, Judge: null);
    }

    private static EndpointUsageDto[] MapEndpoints(ITestRun run, Domain.TestResult.ITestResult result)
        =>
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
                CostUsd: 0
            )
        ];

    private static double EvaluationScoreToFloat(EvaluationScore score) => (int)score;

    private static string EndpointColor(string providerName)
    {
        var lower = providerName.ToLowerInvariant();
        if (lower.Contains("openai")) return "#10a37f";
        if (lower.Contains("azure")) return "#3b82f6";
        if (lower.Contains("anthropic")) return "#d97757";
        return "#8b5cf6";
    }
}
