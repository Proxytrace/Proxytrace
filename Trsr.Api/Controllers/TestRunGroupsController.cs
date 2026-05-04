using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestRuns;
using Trsr.Application.Streaming;
using Trsr.Application.TestRun;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/test-run-groups")]
public class TestRunGroupsController : ControllerBase
{
    private static readonly JsonSerializerOptions SseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ITestRunGroupRepository groupRepository;
    private readonly ITestRunRepository runRepository;
    private readonly ITestSuiteRepository suiteRepository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly ITestRunnerService runner;
    private readonly ITestResultBroadcaster broadcaster;

    public TestRunGroupsController(
        ITestRunGroupRepository groupRepository,
        ITestRunRepository runRepository,
        ITestSuiteRepository suiteRepository,
        IRepository<IModelEndpoint> endpoints,
        ITestRunnerService runner,
        ITestResultBroadcaster broadcaster)
    {
        this.groupRepository = groupRepository;
        this.runRepository = runRepository;
        this.suiteRepository = suiteRepository;
        this.endpoints = endpoints;
        this.runner = runner;
        this.broadcaster = broadcaster;
    }

    [HttpGet]
    public async Task<PagedResult<TestRunGroupDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = agentId.HasValue
            ? await groupRepository.GetByAgentAsync(agentId.Value, cancellationToken)
            : await groupRepository.GetAllAsync(cancellationToken);

        var groups = all
            .OrderByDescending(g => g.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArray();

        var items = await Task.WhenAll(groups.Select(g => ToDtoAsync(g, cancellationToken)));
        return new PagedResult<TestRunGroupDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestRunGroupDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await groupRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var group = await groupRepository.GetAsync(id, cancellationToken);
        return await ToDtoAsync(group, cancellationToken);
    }

    [HttpPost]
    public async Task<ActionResult<TestRunGroupDto>> Create(
        [FromBody] CreateTestRunGroupRequest request,
        CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(request.TestSuiteId, cancellationToken))
            return BadRequest($"Test suite {request.TestSuiteId} not found.");

        if (request.ModelEndpointIds.Count == 0)
            return BadRequest("At least one endpoint must be specified.");

        var suite = await suiteRepository.GetAsync(request.TestSuiteId, cancellationToken);
        var endpointList = await Task.WhenAll(
            request.ModelEndpointIds.Select(id => endpoints.GetAsync(id, cancellationToken)));

        var group = await runner.RunGroupInBackgroundAsync(
            suite, endpointList, cancellationToken);

        return AcceptedAtAction(nameof(Get), new { id = group.Id }, await ToDtoAsync(group, cancellationToken));
    }

    [HttpGet("{id:guid}/stream")]
    public async Task Stream(Guid id, CancellationToken cancellationToken)
    {
        if (!await groupRepository.ContainsAsync(id, cancellationToken))
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = broadcaster.SubscribeToGroup(id, cancellationToken);

        var group = await groupRepository.GetAsync(id, cancellationToken);
        if (group.Status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled)
        {
            var completeEvt = GroupRunCompleteEvent.Create(group);
            var completeData = JsonSerializer.Serialize(completeEvt, SseOptions);
            await Response.WriteAsync($"event: group-run-complete\ndata: {completeData}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
            return;
        }

        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            await WriteEventAsync(evt, cancellationToken);
        }
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<TestRunGroupDto>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        if (!await groupRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var group = await groupRepository.GetAsync(id, cancellationToken);
        group = await runner.CancelAsync(group, cancellationToken);
        return AcceptedAtAction(nameof(Get), new { id = group.Id }, await ToDtoAsync(group, cancellationToken));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await groupRepository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private async Task<TestRunGroupDto> ToDtoAsync(ITestRunGroup group, CancellationToken cancellationToken)
    {
        var runs = await runRepository.GetByGroupAsync(group.Id, cancellationToken);
        return new TestRunGroupDto(
            Id: group.Id,
            SuiteId: group.Suite.Id,
            SuiteName: group.Suite.Name,
            AgentId: group.Suite.Agent.Id,
            AgentName: group.Suite.Agent.Name,
            Status: group.Status,
            CompletedAt: group.CompletedAt,
            Runs: runs.Select(TestRunsController.ToDto).ToArray(),
            CreatedAt: group.CreatedAt,
            UpdatedAt: group.UpdatedAt);
    }

    private async Task WriteEventAsync(TestRunEvent evt, CancellationToken cancellationToken)
    {
        string eventName = evt switch
        {
            GroupRunCompleteEvent => "group-run-complete",
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
}
