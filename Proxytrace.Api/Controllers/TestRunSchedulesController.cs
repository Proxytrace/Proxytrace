using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Auth.Licensing;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestRunSchedule;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/test-run-schedules")]
public class TestRunSchedulesController : ControllerBase
{
    private readonly ITestRunScheduleRepository scheduleRepository;
    private readonly ITestRunGroupRepository groupRepository;
    private readonly ITestRunRepository runRepository;
    private readonly ITestSuiteRepository suiteRepository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly ITestRunSchedule.CreateNew createSchedule;
    private readonly ITestRunnerService runner;
    private readonly TestRunDtoMapper runMapper;

    public TestRunSchedulesController(
        ITestRunScheduleRepository scheduleRepository,
        ITestRunGroupRepository groupRepository,
        ITestRunRepository runRepository,
        ITestSuiteRepository suiteRepository,
        IRepository<IModelEndpoint> endpoints,
        ITestRunSchedule.CreateNew createSchedule,
        ITestRunnerService runner,
        TestRunDtoMapper runMapper)
    {
        this.scheduleRepository = scheduleRepository;
        this.groupRepository = groupRepository;
        this.runRepository = runRepository;
        this.suiteRepository = suiteRepository;
        this.endpoints = endpoints;
        this.createSchedule = createSchedule;
        this.runner = runner;
        this.runMapper = runMapper;
    }

    /// <summary>
    /// Lists schedules. Ungated so existing schedules stay visible after a license downgrade —
    /// only creation/management is feature-gated.
    /// </summary>
    [HttpGet]
    public async Task<IReadOnlyList<TestRunScheduleDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestRunSchedule> schedules;
        if (agentId.HasValue)
            schedules = await scheduleRepository.GetByAgentAsync(agentId.Value, cancellationToken);
        else if (projectId.HasValue)
            schedules = await scheduleRepository.GetByProjectAsync(projectId.Value, cancellationToken);
        else
            schedules = await scheduleRepository.GetAllAsync(cancellationToken);

        return await Task.WhenAll(schedules.Select(s => ToDtoAsync(s, cancellationToken)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestRunScheduleDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var schedule = await scheduleRepository.FindAsync(id, cancellationToken);
        if (schedule is null)
            return NotFound();
        return await ToDtoAsync(schedule, cancellationToken);
    }

    [HttpPost]
    [RequiresFeature(LicenseFeature.ScheduledTestRuns)]
    public async Task<ActionResult<TestRunScheduleDto>> Create(
        [FromBody] CreateTestRunScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var suite = await suiteRepository.FindAsync(request.TestSuiteId, cancellationToken);
        if (suite is null)
            return BadRequest($"Test suite {request.TestSuiteId} not found.");

        if (request.ModelEndpointIds.Count == 0)
            return BadRequest("At least one endpoint must be specified.");

        if (request.IntervalMinutes < 1)
            return BadRequest("Interval must be at least one minute.");

        var endpointList = await Task.WhenAll(
            request.ModelEndpointIds.Select(id => endpoints.GetAsync(id, cancellationToken)));

        var schedule = createSchedule(
            request.Name, suite, endpointList, TimeSpan.FromMinutes(request.IntervalMinutes), request.Enabled,
            request.AnchorAt ?? DateTimeOffset.UtcNow);
        schedule = await scheduleRepository.AddAsync(schedule, cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = schedule.Id }, await ToDtoAsync(schedule, cancellationToken));
    }

    [HttpPatch("{id:guid}")]
    [RequiresFeature(LicenseFeature.ScheduledTestRuns)]
    public async Task<ActionResult<TestRunScheduleDto>> Update(
        Guid id,
        [FromBody] UpdateTestRunScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var schedule = await scheduleRepository.FindAsync(id, cancellationToken);
        if (schedule is null)
            return NotFound();

        if (request.ModelEndpointIds.Count == 0)
            return BadRequest("At least one endpoint must be specified.");

        if (request.IntervalMinutes < 1)
            return BadRequest("Interval must be at least one minute.");

        var endpointList = await Task.WhenAll(
            request.ModelEndpointIds.Select(eid => endpoints.GetAsync(eid, cancellationToken)));

        schedule = await schedule.Update(
            request.Name, endpointList, TimeSpan.FromMinutes(request.IntervalMinutes), request.Enabled,
            request.AnchorAt ?? schedule.AnchorAt, DateTimeOffset.UtcNow, cancellationToken);

        return await ToDtoAsync(schedule, cancellationToken);
    }

    [HttpDelete("{id:guid}")]
    [RequiresFeature(LicenseFeature.ScheduledTestRuns)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var schedule = await scheduleRepository.FindAsync(id, cancellationToken);
        if (schedule is null)
            return NotFound();

        await scheduleRepository.RemoveAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/run-now")]
    [RequiresFeature(LicenseFeature.ScheduledTestRuns)]
    public async Task<ActionResult<TestRunScheduleDto>> RunNow(Guid id, CancellationToken cancellationToken)
    {
        var schedule = await scheduleRepository.FindAsync(id, cancellationToken);
        if (schedule is null)
            return NotFound();

        await runner.RunInBackgroundAsync(
            schedule.Suite, schedule.Endpoints.ToArray(), schedule.Id, cancellationToken);

        return await ToDtoAsync(schedule, cancellationToken);
    }

    private async Task<TestRunScheduleDto> ToDtoAsync(ITestRunSchedule schedule, CancellationToken cancellationToken)
    {
        var recentGroups = await groupRepository.GetByScheduleAsync(schedule.Id, 5, cancellationToken);
        var recentRuns = await Task.WhenAll(
            recentGroups.Select(g => runMapper.ToListItemDtoAsync(g, runRepository, cancellationToken)));

        return new TestRunScheduleDto(
            Id: schedule.Id,
            Name: schedule.Name,
            SuiteId: schedule.Suite.Id,
            SuiteName: schedule.Suite.Name,
            AgentId: schedule.Suite.Agent.Id,
            AgentName: schedule.Suite.Agent.Name,
            Endpoints: schedule.Endpoints.Select(e => new ScheduleEndpointDto(e.Id, e.Model.Name)).ToArray(),
            IntervalMinutes: (int)schedule.Interval.TotalMinutes,
            IsEnabled: schedule.IsEnabled,
            AnchorAt: schedule.AnchorAt,
            NextRunAt: schedule.NextRunAt,
            LastRunAt: schedule.LastRunAt,
            RecentRuns: recentRuns,
            CreatedAt: schedule.CreatedAt,
            UpdatedAt: schedule.UpdatedAt);
    }
}
