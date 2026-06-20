using System.ComponentModel;
using ModelContextProtocol;
using ModelContextProtocol.Server;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Api.Mcp.Tools;

/// <summary>
/// MCP tools for listing, starting and cancelling test runs (run groups) in the current project.
/// </summary>
[McpServerToolType]
internal sealed class RunTools
{
    private readonly IMcpProjectAccessor project;
    private readonly ITestRunGroupRepository groups;
    private readonly ITestRunRepository runs;
    private readonly ITestSuiteRepository suites;
    private readonly ITestRunnerService runner;
    private readonly TestRunDtoMapper mapper;

    public RunTools(
        IMcpProjectAccessor project,
        ITestRunGroupRepository groups,
        ITestRunRepository runs,
        ITestSuiteRepository suites,
        ITestRunnerService runner,
        TestRunDtoMapper mapper)
    {
        this.project = project;
        this.groups = groups;
        this.runs = runs;
        this.suites = suites;
        this.runner = runner;
        this.mapper = mapper;
    }

    [McpServerTool(Name = "list_test_runs")]
    [Description("List test runs (run groups) in the current project, newest first, with per-run status " +
                 "and pass/fail counts. System runs are excluded.")]
    public async Task<IReadOnlyList<TestRunGroupListItemDto>> ListTestRuns(
        [Description("Maximum number of runs to return (1-100, default 50).")] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var p = await project.GetProjectAsync(cancellationToken);
        limit = Math.Clamp(limit, 1, 100);
        var paged = await groups.GetByProjectPagedAsync(p.Id, 1, limit, includeSystem: false, cancellationToken);
        return await Task.WhenAll(
            paged.Items.Select(g => mapper.ToListItemDtoAsync(g, runs, cancellationToken)));
    }

    [McpServerTool(Name = "get_test_run")]
    [Description("Get a single test run (run group) by id, including each run's status and results. " +
                 "The run must belong to the current project.")]
    public async Task<TestRunGroupDto> GetTestRun(
        [Description("The run group id (GUID), as returned by list_test_runs or start_test_run.")] Guid runGroupId,
        CancellationToken cancellationToken)
    {
        var group = await RequireGroupAsync(runGroupId, cancellationToken);
        return await ToDtoAsync(group, cancellationToken);
    }

    [McpServerTool(Name = "start_test_run")]
    [Description("Start a test run of a suite against its agent's current endpoint. Returns the run group; " +
                 "poll get_test_run for progress. The suite must belong to the current project. NOTE: a run " +
                 "makes real LLM calls and incurs cost.")]
    public async Task<TestRunGroupDto> StartTestRun(
        [Description("The suite id (GUID) to run, from list_suites.")] Guid suiteId,
        CancellationToken cancellationToken)
    {
        project.RequireWriteScope();
        var p = await project.GetProjectAsync(cancellationToken);
        var suite = await suites.FindAsync(suiteId, cancellationToken);
        if (suite is null || suite.Agent.Project.Id != p.Id)
            throw new McpException($"Suite '{suiteId}' was not found in this project.");

        var group = await runner.RunInBackgroundAsync(
            suite, [suite.Agent.Endpoint], cancellationToken: cancellationToken);
        return await ToDtoAsync(group, cancellationToken);
    }

    [McpServerTool(Name = "cancel_test_run")]
    [Description("Cancel an in-progress test run (run group). The run must belong to the current project.")]
    public async Task<TestRunGroupDto> CancelTestRun(
        [Description("The run group id (GUID) to cancel, from list_test_runs.")] Guid runGroupId,
        CancellationToken cancellationToken)
    {
        project.RequireWriteScope();
        var group = await RequireGroupAsync(runGroupId, cancellationToken);
        var cancelled = await runner.CancelAsync(group, cancellationToken);
        return await ToDtoAsync(cancelled, cancellationToken);
    }

    private async Task<ITestRunGroup> RequireGroupAsync(Guid runGroupId, CancellationToken cancellationToken)
    {
        var p = await project.GetProjectAsync(cancellationToken);
        var group = await groups.FindAsync(runGroupId, cancellationToken);
        if (group is null || group.Suite.Agent.Project.Id != p.Id)
            throw new McpException($"Test run '{runGroupId}' was not found in this project.");
        return group;
    }

    private async Task<TestRunGroupDto> ToDtoAsync(ITestRunGroup group, CancellationToken cancellationToken)
    {
        var groupRuns = await runs.GetByGroupAsync(group.Id, cancellationToken);
        return new TestRunGroupDto(
            Id: group.Id,
            SuiteId: group.Suite.Id,
            SuiteName: group.Suite.Name,
            AgentId: group.Suite.Agent.Id,
            AgentName: group.Suite.Agent.Name,
            Status: group.Status,
            IsSystemRun: group.IsSystemRun,
            CompletedAt: group.CompletedAt,
            Runs: groupRuns.Select(mapper.ToDto).ToArray(),
            CreatedAt: group.CreatedAt,
            UpdatedAt: group.UpdatedAt);
    }
}
