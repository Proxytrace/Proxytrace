using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Evaluators;
using Trsr.Api.Dto.TestRuns;
using Trsr.Domain;
using Trsr.Domain.Completion;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;

namespace Trsr.Api.Controllers;

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
        if (!await testCases.ContainsAsync(testCaseId, cancellationToken))
            return NotFound($"Test case {testCaseId} not found.");

        var testCase = await testCases.GetAsync(testCaseId, cancellationToken);
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

    [HttpPost("run")]
    public async Task<ActionResult<EvaluationResultDto>> Run(
        Guid evaluatorId,
        [FromBody] RunEvaluatorOnBenchRequest request,
        CancellationToken cancellationToken)
    {
        if (!await evaluators.ContainsAsync(evaluatorId, cancellationToken))
            return NotFound($"Evaluator {evaluatorId} not found.");
        if (!await testCases.ContainsAsync(request.TestCaseId, cancellationToken))
            return NotFound($"Test case {request.TestCaseId} not found.");

        var evaluator = await evaluators.GetAsync(evaluatorId, cancellationToken);
        var testCase = await testCases.GetAsync(request.TestCaseId, cancellationToken);

        AssistantMessage actual;
        TimeSpan latency;
        if (request.ActualResponseOverride is not null)
        {
            actual = new AssistantMessage([Trsr.Domain.Message.Content.FromText(request.ActualResponseOverride)], []);
            latency = TimeSpan.Zero;
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
            evaluation.Reasoning);
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
