using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Api.Json;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/test-runs")]
public class TestRunsController : ControllerBase
{
    private readonly ITestRunRepository repository;
    private readonly ITestResultBroadcaster broadcaster;
    private readonly TestRunDtoMapper mapper;

    public TestRunsController(
        ITestRunRepository repository,
        ITestResultBroadcaster broadcaster,
        TestRunDtoMapper mapper)
    {
        this.repository = repository;
        this.broadcaster = broadcaster;
        this.mapper = mapper;
    }

    [HttpGet]
    public async Task<PagedResult<TestRunDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var paged = agentId.HasValue
            ? await repository.GetByAgentPagedAsync(agentId.Value, page, pageSize, cancellationToken)
            : await repository.GetPagedAsync(page, pageSize, cancellationToken);
        return paged.Map(mapper.ToDto);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestRunDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var run = await repository.FindAsync(id, cancellationToken);
        if (run is null)
            return NotFound();
        return mapper.ToDto(run);
    }

    [HttpGet("{id:guid}/cases/{caseId:guid}/fixture")]
    public async Task<ActionResult<TestCaseFixtureDto>> GetCaseFixture(
        Guid id, Guid caseId, CancellationToken cancellationToken)
    {
        var run = await repository.FindAsync(id, cancellationToken);
        if (run is null)
            return NotFound();
        var result = run.TestResults.FirstOrDefault(r => r.TestCase.Id == caseId);
        if (result is null)
            return NotFound();
        return mapper.ToFixtureDto(run, result);
    }

    [HttpGet("{id:guid}/cases/{caseId:guid}/request")]
    public async Task<ActionResult<ModelRequestPreviewDto>> GetCaseRequest(
        Guid id, Guid caseId, CancellationToken cancellationToken)
    {
        var run = await repository.FindAsync(id, cancellationToken);
        if (run is null)
            return NotFound();
        var testCase = run.Group.Suite.TestCases.FirstOrDefault(tc => tc.Id == caseId);
        if (testCase is null)
            return NotFound();

        var client = run.Group.Suite.Agent.CreateClient(customEndpoint: run.Endpoint, skipIngestion: true);
        var preview = client.BuildRequestPreview(testCase.Input);
        return mapper.ToRequestDto(preview);
    }

    [HttpGet("{id:guid}/stream")]
    public async Task Stream(Guid id, CancellationToken cancellationToken)
    {
        var run = await repository.FindAsync(id, cancellationToken);
        if (run is null)
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = broadcaster.Subscribe(id, cancellationToken);
        if (run.Status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled)
        {
            var completeEvt = RunCompleteEvent.Create(run);
            var completeData = JsonSerializer.Serialize(completeEvt, completeEvt.GetType(), ApiJsonOptions.Sse);
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
    public Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => this.DeleteOrConflictAsync(
            () => repository.RemoveAsync(id, cancellationToken),
            "This test run is still referenced by an optimization proposal. Remove the proposal before deleting the run.");

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
        var data = JsonSerializer.Serialize(evt, evt.GetType(), ApiJsonOptions.Sse);
        await Response.WriteAsync($"event: {eventName}\ndata: {data}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}
