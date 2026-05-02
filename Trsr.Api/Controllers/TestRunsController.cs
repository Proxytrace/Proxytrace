using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestRuns;
using Trsr.Application.Streaming;
using Trsr.Application.TestRun;
using Trsr.Domain;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

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
    private readonly ITestSuiteRepository suiteRepository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly ITestRunnerService runner;
    private readonly ITestResultBroadcaster broadcaster;

    public TestRunsController(
        ITestRunRepository repository,
        ITestSuiteRepository suiteRepository,
        IRepository<IModelEndpoint> endpoints,
        ITestRunnerService runner,
        ITestResultBroadcaster broadcaster)
    {
        this.repository = repository;
        this.suiteRepository = suiteRepository;
        this.endpoints = endpoints;
        this.runner = runner;
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

    [HttpPost]
    public async Task<ActionResult<TestRunDto>> Create(
        [FromBody] CreateTestRunRequest request,
        CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(request.TestSuiteId, cancellationToken))
            return BadRequest($"Test suite {request.TestSuiteId} not found.");
        var suite = await suiteRepository.GetAsync(request.TestSuiteId, cancellationToken);
        var endpoint = await endpoints.GetAsync(request.ModelEndpointId, cancellationToken);
        var run = await runner.RunInBackgroundAsync(suite, endpoint, cancellationToken);
        return AcceptedAtAction(nameof(Get), new { id = run.Id }, ToDto(run));
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

        // Handle the case where the run already completed before we subscribed.
        var run = await repository.GetAsync(id, cancellationToken);
        if (run.Status is TestRunStatus.Completed or TestRunStatus.Failed)
        {
            var completeEvt = new RunCompleteEvent(run.Id, run.Status, run.CompletedAt);
            var completeData = JsonSerializer.Serialize(completeEvt, completeEvt.GetType(), SseOptions);
            await Response.WriteAsync($"event: run-complete\ndata: {completeData}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
            return;
        }

        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            var eventName = evt switch
            {
                TestResultArrivedEvent => "test-result-arrived",
                RunCompleteEvent => "run-complete",
                _ => "unknown",
            };
            var data = JsonSerializer.Serialize(evt, evt.GetType(), SseOptions);
            await Response.WriteAsync($"event: {eventName}\ndata: {data}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    internal static TestRunDto ToDto(ITestRun r)
    {
        var passed = r.TestResults.Count(x => x.Evaluations == Evaluation.Pass);
        var total = r.TestResults.Count;
        var passRate = total > 0 ? Math.Round((double)passed / total * 100) : 0;
        long? durationMs = r.CompletedAt.HasValue
            ? (long)(r.CompletedAt.Value - r.CreatedAt).TotalMilliseconds
            : null;

        return new TestRunDto(
            Id: r.Id,
            SuiteId: r.Suite.Id,
            SuiteName: r.Suite.Name,
            AgentId: r.Suite.Agent.Id,
            AgentName: r.Suite.Agent.Name,
            Status: r.Status,
            TotalCases: total,
            PassedCases: passed,
            FailedCases: total - passed,
            PassRate: passRate,
            StartedAt: r.CreatedAt,
            CompletedAt: r.CompletedAt,
            DurationMs: durationMs,
            TestCases: r.Suite.TestCases.Select(tc => new TestCaseRowDto(tc.Id, SummarizeTestCase(tc))).ToArray(),
            Results: r.TestResults.Select(res => new TestResultDto(
                res.Id,
                res.TestCase.Id,
                SummarizeTestCase(res.TestCase),
                string.Concat(res.ActualResponse.Contents.Select(c => c.Text ?? "")),
                res.Evaluations,
                (long)res.Duration.TotalMilliseconds
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
}
