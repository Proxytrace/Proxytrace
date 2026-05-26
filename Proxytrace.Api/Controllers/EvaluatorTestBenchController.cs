using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Evaluators;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Domain;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestResult;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/evaluators/{evaluatorId:guid}/test-bench")]
public class EvaluatorTestBenchController : ControllerBase
{
    private readonly IEvaluatorRepository evaluators;
    private readonly ITestCaseRepository testCases;
    private readonly ITestResultRepository testResults;
    private readonly ICompletion.Create createCompletion;
    private readonly ITestResult.CreateNew createTestResult;

    public EvaluatorTestBenchController(
        IEvaluatorRepository evaluators,
        ITestCaseRepository testCases,
        ITestResultRepository testResults,
        ICompletion.Create createCompletion,
        ITestResult.CreateNew createTestResult)
    {
        this.evaluators = evaluators;
        this.testCases = testCases;
        this.testResults = testResults;
        this.createCompletion = createCompletion;
        this.createTestResult = createTestResult;
    }

    [HttpGet("load")]
    public async Task<ActionResult<EvaluatorTestBenchPayloadDto>> Load(
        Guid evaluatorId,
        [FromQuery] Guid testCaseId,
        CancellationToken cancellationToken)
    {
        if (!await evaluators.ContainsAsync(evaluatorId, cancellationToken))
            return NotFound($"Evaluator {evaluatorId} not found.");
        var testCase = await testCases.FindAsync(testCaseId, cancellationToken);
        if (testCase is null)
            return NotFound($"Test case {testCaseId} not found.");

        var latest = await testResults.GetLatestByTestCaseAsync(testCaseId, cancellationToken);
        if (latest is null)
            return NotFound($"No test result exists for test case {testCaseId}.");

        return new EvaluatorTestBenchPayloadDto(
            SourceTestResultId: latest.Id,
            TestCaseId: testCase.Id,
            TestCaseSummary: Summarize(testCase),
            Conversation: testCase.Input.Messages
                .Select(m => new TestRunMessageDto(m.Role.ToString().ToLowerInvariant(), ToText(m)))
                .ToArray(),
            ExpectedResponse: ToText(testCase.ExpectedOutput),
            ActualResponse: ToText(latest.ActualResponse));
    }

    [HttpGet("default")]
    public async Task<ActionResult<EvaluatorTestBenchDefaultDto>> Default(
        Guid evaluatorId,
        CancellationToken cancellationToken)
    {
        if (!await evaluators.ContainsAsync(evaluatorId, cancellationToken))
            return NotFound($"Evaluator {evaluatorId} not found.");

        var latest = await testResults.GetLatestByEvaluatorAsync(evaluatorId, cancellationToken);
        return latest is null
            ? new EvaluatorTestBenchDefaultDto(null, null) 
            : new EvaluatorTestBenchDefaultDto(latest.TestCase.Id, Summarize(latest.TestCase));
    }

    [HttpGet("recent")]
    public async Task<ActionResult<IReadOnlyList<EvaluatorTestBenchRecentItemDto>>> Recent(
        Guid evaluatorId,
        [FromQuery] int count,
        CancellationToken cancellationToken)
    {
        if (!await evaluators.ContainsAsync(evaluatorId, cancellationToken))
            return NotFound($"Evaluator {evaluatorId} not found.");

        var capped = Math.Clamp(count, 1, 50);
        var recent = await testResults.GetRecentByEvaluatorAsync(evaluatorId, capped, cancellationToken);
        return recent
            .Select(r => new EvaluatorTestBenchRecentItemDto(r.TestCase.Id, Summarize(r.TestCase)))
            .ToArray();
    }

    [HttpPost("run")]
    public async Task<ActionResult<EvaluationResultDto>> Run(
        Guid evaluatorId,
        [FromBody] RunEvaluatorOnBenchRequest request,
        CancellationToken cancellationToken)
    {
        var evaluator = await evaluators.FindAsync(evaluatorId, cancellationToken);
        if (evaluator is null)
            return NotFound($"Evaluator {evaluatorId} not found.");
        var testCase = await testCases.FindAsync(request.TestCaseId, cancellationToken);
        if (testCase is null)
            return NotFound($"Test case {request.TestCaseId} not found.");

        AssistantMessage actual;
        TimeSpan latency;
        if (request.ActualResponseOverride is not null)
        {
            actual = new AssistantMessage([Domain.Message.Content.FromText(request.ActualResponseOverride)], []);
            var latest = await testResults.GetLatestByTestCaseAsync(request.TestCaseId, cancellationToken);
            latency = latest?.Latency ?? TimeSpan.FromMilliseconds(1);
        }
        else
        {
            var latest = await testResults.GetLatestByTestCaseAsync(request.TestCaseId, cancellationToken);
            if (latest is null)
                return NotFound($"No test result exists for test case {request.TestCaseId}.");
            actual = latest.ActualResponse;
            latency = latest.Latency;
        }

        var completion = createCompletion(actual, null, latency);
        var transient = createTestResult(testCase, completion, []);

        var evaluation = await evaluator.EvaluateAsync(transient, cancellationToken);
        if (evaluation is null)
            return UnprocessableEntity($"Evaluator returned no evaluation.");

        return new EvaluationResultDto(
            evaluator.Id,
            evaluator.Kind,
            evaluator.Name,
            evaluation.Score,
            evaluation.Reasoning,
            evaluation.ErrorMessage);
    }

    private static string Summarize(ITestCase tc)
    {
        var firstUser = tc.Input.Messages.OfType<UserMessage>().FirstOrDefault();
        if (firstUser is null) return "Test case";
        var text = string.Concat(firstUser.Contents.Select(c => c.Text ?? ""));
        return text.Length > 80 ? text[..77] + "…" : text;
    }

    private static string ToText(Message msg)
        => string.Concat(msg.Contents.Select(c => c.Text ?? ""));
}
