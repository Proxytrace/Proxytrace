using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Api.Json;
using Proxytrace.Application.Optimization;
using Proxytrace.Application.Streaming;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/test-run-groups")]
public class TestRunGroupsController : ControllerBase
{
    private readonly ITestRunGroupRepository groupRepository;
    private readonly ITestRunRepository runRepository;
    private readonly ITestSuiteRepository suiteRepository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly ITestRunnerService runner;
    private readonly ITestResultBroadcaster broadcaster;
    private readonly IOptimizerService optimizerService;
    private readonly TestRunDtoMapper runMapper;

    public TestRunGroupsController(
        ITestRunGroupRepository groupRepository,
        ITestRunRepository runRepository,
        ITestSuiteRepository suiteRepository,
        IRepository<IModelEndpoint> endpoints,
        ITestRunnerService runner,
        ITestResultBroadcaster broadcaster,
        IOptimizerService optimizerService,
        TestRunDtoMapper runMapper)
    {
        this.groupRepository = groupRepository;
        this.runRepository = runRepository;
        this.suiteRepository = suiteRepository;
        this.endpoints = endpoints;
        this.runner = runner;
        this.broadcaster = broadcaster;
        this.optimizerService = optimizerService;
        this.runMapper = runMapper;
    }

    [HttpGet]
    public async Task<PagedResult<TestRunGroupDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        PagedResult<ITestRunGroup> paged;
        if (agentId.HasValue)
            paged = await groupRepository.GetByAgentPagedAsync(agentId.Value, page, pageSize, cancellationToken);
        else if (projectId.HasValue)
            paged = await groupRepository.GetByProjectPagedAsync(projectId.Value, page, pageSize, cancellationToken);
        else
            paged = await groupRepository.GetPagedAsync(page, pageSize, cancellationToken);

        var items = await Task.WhenAll(paged.Items.Select(g => ToDtoAsync(g, cancellationToken)));
        return new PagedResult<TestRunGroupDto>(items, paged.Total, paged.Page, paged.PageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestRunGroupDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var group = await groupRepository.FindAsync(id, cancellationToken);
        if (group is null)
            return NotFound();
        return await ToDtoAsync(group, cancellationToken);
    }

    [HttpPost]
    public async Task<ActionResult<TestRunGroupDto>> Create(
        [FromBody] CreateTestRunGroupRequest request,
        CancellationToken cancellationToken)
    {
        var suite = await suiteRepository.FindAsync(request.TestSuiteId, cancellationToken);
        if (suite is null)
            return BadRequest($"Test suite {request.TestSuiteId} not found.");

        if (request.ModelEndpointIds.Count == 0)
            return BadRequest("At least one endpoint must be specified.");

        var endpointList = await Task.WhenAll(
            request.ModelEndpointIds.Select(id => endpoints.GetAsync(id, cancellationToken)));

        var group = await runner.RunInBackgroundAsync(
            suite, endpointList, cancellationToken);

        return AcceptedAtAction(nameof(Get), new { id = group.Id }, await ToDtoAsync(group, cancellationToken));
    }

    [HttpGet("{id:guid}/stream")]
    public async Task Stream(Guid id, CancellationToken cancellationToken)
    {
        var group = await groupRepository.FindAsync(id, cancellationToken);
        if (group is null)
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = broadcaster.SubscribeToGroup(id, cancellationToken);
        if (group.Status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled)
        {
            var completeEvt = GroupRunCompleteEvent.Create(group);
            var completeData = JsonSerializer.Serialize(completeEvt, ApiJsonOptions.Sse);
            await Response.WriteAsync($"event: group-run-complete\ndata: {completeData}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
            return;
        }

        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            await WriteEventAsync(evt, cancellationToken);
        }
    }

    [HttpPost("{id:guid}/optimize")]
    public async Task<IActionResult> Optimize(Guid id, CancellationToken cancellationToken)
    {
        var group = await groupRepository.FindAsync(id, cancellationToken);
        if (group is null)
            return NotFound();
        if (group.Status is not TestRunStatus.Completed)
            return BadRequest("Only completed test run groups can be optimized.");
        await optimizerService.EnqueueAsync(group, cancellationToken);
        return Accepted();
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<TestRunGroupDto>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var group = await groupRepository.FindAsync(id, cancellationToken);
        if (group is null)
            return NotFound();
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
            Runs: runs.Select(runMapper.ToDto).ToArray(),
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
        var data = JsonSerializer.Serialize(evt, evt.GetType(), ApiJsonOptions.Sse);
        await Response.WriteAsync($"event: {eventName}\ndata: {data}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}
