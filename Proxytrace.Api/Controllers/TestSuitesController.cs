using Proxytrace.Domain.Statistics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Dto.TestSuites;
using Proxytrace.Domain.Statistics.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.AuditLog;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/test-suites")]
public class TestSuitesController : ControllerBase
{
    private readonly ITestSuiteRepository suiteRepository;
    private readonly IAgentRepository agentRepository;
    private readonly IAgentCallRepository agentCallRepository;
    private readonly ITestCaseRepository testCaseRepository;
    private readonly IEvaluatorRepository evaluatorRepository;
    private readonly ITestCase.CreateNew createTestCase;
    private readonly ITestCase.CreateNewFromCall createTestCaseFromCall;
    private readonly IExactMatchEvaluator.CreateNew createEvaluator;
    private readonly ITestSuite.CreateNew createSuite;
    private readonly ITestSuite.CreateExisting createSuiteExisting;
    private readonly TestSuiteDtoMapper mapper;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;
    private readonly ILicenseService license;
    private readonly IProjectAccessGuard accessGuard;
    private readonly ILogger<Audit> audit;

    public TestSuitesController(
        ITestSuiteRepository suiteRepository,
        IAgentRepository agentRepository,
        IAgentCallRepository agentCallRepository,
        ITestCaseRepository testCaseRepository,
        IEvaluatorRepository evaluatorRepository,
        ITestCase.CreateNew createTestCase,
        ITestCase.CreateNewFromCall createTestCaseFromCall,
        IExactMatchEvaluator.CreateNew createEvaluator,
        ITestSuite.CreateNew createSuite,
        ITestSuite.CreateExisting createSuiteExisting,
        TestSuiteDtoMapper mapper,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        ILicenseService license,
        IProjectAccessGuard accessGuard,
        ILogger<Audit> audit)
    {
        this.audit = audit;
        this.accessGuard = accessGuard;
        this.suiteRepository = suiteRepository;
        this.agentRepository = agentRepository;
        this.agentCallRepository = agentCallRepository;
        this.testCaseRepository = testCaseRepository;
        this.evaluatorRepository = evaluatorRepository;
        this.createTestCase = createTestCase;
        this.createTestCaseFromCall = createTestCaseFromCall;
        this.createEvaluator = createEvaluator;
        this.createSuite = createSuite;
        this.createSuiteExisting = createSuiteExisting;
        this.mapper = mapper;
        this.runStats = runStats;
        this.license = license;
    }

    [HttpGet]
    public async Task<PagedResult<TestSuiteListItemDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var scopeProjectId = projectId;
        if (agentId.HasValue)
        {
            var scopeAgent = await agentRepository.FindAsync(agentId.Value, cancellationToken);
            if (scopeAgent is null)
                return new PagedResult<TestSuiteListItemDto>([], 0, page, pageSize);
            scopeProjectId = scopeAgent.Project.Id;
        }

        if (!await CanListAsync(scopeProjectId, cancellationToken))
            return new PagedResult<TestSuiteListItemDto>([], 0, page, pageSize);

        PagedResult<ITestSuite> paged;
        if (agentId.HasValue)
            paged = await suiteRepository.GetByAgentPagedAsync(agentId.Value, page, pageSize, cancellationToken);
        else if (projectId.HasValue)
            paged = await suiteRepository.GetByProjectPagedAsync(projectId.Value, page, pageSize, cancellationToken);
        else
            paged = await suiteRepository.GetPagedAsync(page, pageSize, cancellationToken);

        var statsBySuite = await GetRunStatsBySuiteAsync(
            paged.Items.Select(s => s.Id).ToArray(), cancellationToken);

        return paged.Map(s => mapper.ToListItemDto(
            s,
            statsBySuite.TryGetValue(s.Id, out var rows) ? rows : []));
    }

    /// <summary>
    /// Loads finalized run statistics for the given suites, grouped by suite id.
    /// Returns an empty map when no suite ids are supplied.
    /// </summary>
    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<TestRunStats>>> GetRunStatsBySuiteAsync(
        IReadOnlyCollection<Guid> suiteIds,
        CancellationToken cancellationToken)
    {
        if (suiteIds.Count == 0)
            return new Dictionary<Guid, IReadOnlyList<TestRunStats>>();

        // Scope the projection to the wanted suites in SQL (WHERE SuiteId IN (...)) rather than
        // materializing the whole TestRunStats table and filtering in memory — the latter is
        // O(all-rows) on every suites list and single-suite GET as run history grows (#253).
        var rows = await runStats.QueryAsync(
            new TestRunStats.Filter(SuiteIds: suiteIds), cancellationToken);
        return rows
            .GroupBy(r => r.SuiteId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<TestRunStats>)g.ToArray());
    }

    private async Task<bool> CanListAsync(Guid? projectId, CancellationToken cancellationToken)
    {
        var accessible = await accessGuard.GetAccessibleProjectIdsAsync(cancellationToken);
        return accessible is null || (projectId.HasValue && accessible.Contains(projectId.Value));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestSuiteDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var suite = await suiteRepository.FindAsync(id, cancellationToken);
        if (suite is null)
            return NotFound();
        if (!await accessGuard.CanAccessProjectAsync(suite.Agent.Project.Id, cancellationToken))
            return NotFound();
        var statsBySuite = await GetRunStatsBySuiteAsync([id], cancellationToken);
        return mapper.ToDto(
            suite,
            statsBySuite.TryGetValue(id, out var rows) ? rows : []);
    }

    /// <summary>
    /// Bucket (time-window) run statistics for a suite: run count, pass rate, average run duration,
    /// and total cost over the optional [from, to] window. Reuses the per-run stats projection — no
    /// per-test-case aggregation. Omitting both bounds yields all-time stats.
    /// </summary>
    [HttpGet("{id:guid}/run-stats")]
    public async Task<ActionResult<SuiteRunStatsDto>> GetRunStats(
        Guid id,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken cancellationToken = default)
    {
        var suite = await suiteRepository.FindAsync(id, cancellationToken);
        if (suite is null)
            return NotFound();
        if (!await accessGuard.CanAccessProjectAsync(suite.Agent.Project.Id, cancellationToken))
            return NotFound();

        var rows = await runStats.QueryAsync(
            new TestRunStats.Filter(SuiteId: id, From: from, To: to), cancellationToken);
        return mapper.ToRunStatsDto(rows);
    }

    [HttpPost]
    public async Task<ActionResult<TestSuiteDto>> Create(
        [FromBody] CreateTestSuiteRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");

        var agent = await agentRepository.FindAsync(request.AgentId, cancellationToken);
        if (agent is null)
            return BadRequest($"Agent {request.AgentId} not found.");
        if (!await accessGuard.CanAccessProjectAsync(agent.Project.Id, cancellationToken))
            return NotFound();

        license.Ensure(LicenseLimit.MaxTestSuites, await suiteRepository.CountAsync(cancellationToken));

        IReadOnlyCollection<IEvaluator> evaluators;
        if (request.EvaluatorIds is { Count: > 0 })
        {
            var distinctEvalIds = request.EvaluatorIds.Distinct().ToArray();
            evaluators = await evaluatorRepository.GetManyAsync(distinctEvalIds, cancellationToken);
        }
        else
        {
            var defaultEvaluator = createEvaluator(agent.Project);
            var savedDefault = await evaluatorRepository.AddAsync(defaultEvaluator, cancellationToken);
            evaluators = [savedDefault];
        }

        var testCases = new List<ITestCase>();
        foreach (var tc in request.TestCases)
        {
            var testCase = await BuildTestCase(tc.FromAgentCallId, tc.Input, tc.ExpectedOutput, cancellationToken);
            if (testCase is null)
                return BadRequest("Each test case must have either fromAgentCallId or both input and expectedOutput.");
            var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
            testCases.Add(saved);
        }

        var suite = createSuite(request.Name, agent, evaluators, testCases);
        var savedSuite = await suiteRepository.AddAsync(suite, cancellationToken);
        var projectId = await agentRepository.GetProjectIdAsync(agent.Id, cancellationToken);
        audit.LogAudit(AuditAction.TestSuiteCreated, nameof(ITestSuite), savedSuite.Id, savedSuite.Name, projectId: projectId);
        return CreatedAtAction(nameof(Get), new { id = savedSuite.Id }, mapper.ToDto(savedSuite));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TestSuiteDto>> Update(
        Guid id,
        [FromBody] UpdateTestSuiteRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await suiteRepository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();
        if (!await accessGuard.CanAccessProjectAsync(existing.Agent.Project.Id, cancellationToken))
            return NotFound();

        var agent = request.AgentId.HasValue && request.AgentId.Value != existing.Agent.Id
            ? await agentRepository.GetAsync(request.AgentId.Value, cancellationToken)
            : existing.Agent;

        IReadOnlyCollection<IEvaluator> evaluators = existing.Evaluators;
        if (request.EvaluatorIds is not null)
            evaluators = await evaluatorRepository.GetManyAsync(request.EvaluatorIds.Distinct().ToArray(), cancellationToken);

        IReadOnlyCollection<ITestCase> testCases = existing.TestCases;
        if (request.TestCaseIds is not null)
            testCases = await testCaseRepository.GetManyAsync(request.TestCaseIds.Distinct().ToArray(), cancellationToken);

        var updated = createSuiteExisting(existing.Name, agent, evaluators, testCases, existing);
        var saved = await suiteRepository.UpdateAsync(updated, cancellationToken);
        var projectId = await agentRepository.GetProjectIdAsync(agent.Id, cancellationToken);
        audit.LogAudit(AuditAction.TestSuiteUpdated, nameof(ITestSuite), saved.Id, saved.Name, projectId: projectId);
        return mapper.ToDto(saved);
    }

    // Deleting a suite cascades to its run groups, runs, schedules, theories, and the proposals
    // produced from those runs (see the storage FK config) — so the delete always succeeds. The
    // DbUpdateExceptionMapper middleware still maps any unforeseen constraint to a friendly 409.
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var suite = await suiteRepository.FindAsync(id, cancellationToken);
        if (suite is null)
            return NotFound();
        if (!await accessGuard.CanAccessProjectAsync(suite.Agent.Project.Id, cancellationToken))
            return NotFound();

        if (!await suiteRepository.RemoveAsync(id, cancellationToken))
            return NotFound();

        var projectId = await agentRepository.GetProjectIdAsync(suite.Agent.Id, cancellationToken);
        audit.LogAudit(AuditAction.TestSuiteDeleted, nameof(ITestSuite), id, suite.Name, projectId: projectId);
        return NoContent();
    }

    /// <summary>
    /// Creates a new test suite by promoting a curated selection of traced agent calls.
    /// Each selected trace becomes a test case whose expected output is the actual response
    /// recorded during that call, preserving the link back to the source trace.
    /// </summary>
    [HttpPost("from-traces")]
    public async Task<ActionResult<TestSuiteDto>> PromoteFromTraces(
        [FromBody] PromoteTracesRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (request.AgentCallIds.Count == 0)
            return BadRequest("At least one agent call ID must be provided.");

        var agent = await agentRepository.FindAsync(request.AgentId, cancellationToken);
        if (agent is null)
            return BadRequest($"Agent {request.AgentId} not found.");
        if (!await accessGuard.CanAccessProjectAsync(agent.Project.Id, cancellationToken))
            return NotFound();

        license.Ensure(LicenseLimit.MaxTestSuites, await suiteRepository.CountAsync(cancellationToken));

        IReadOnlyCollection<IEvaluator> evaluators;
        if (request.EvaluatorIds is { Count: > 0 })
        {
            evaluators = await evaluatorRepository.GetManyAsync(request.EvaluatorIds.Distinct().ToArray(), cancellationToken);
        }
        else
        {
            var defaultEvaluator = createEvaluator(agent.Project);
            var savedDefault = await evaluatorRepository.AddAsync(defaultEvaluator, cancellationToken);
            evaluators = [savedDefault];
        }

        var testCases = new List<ITestCase>();
        foreach (var callId in request.AgentCallIds.Distinct())
        {
            var call = await agentCallRepository.FindAsync(callId, cancellationToken);
            // A trace is only promotable when the caller can access its owning project — otherwise a
            // crafted agentCallId would copy another tenant's trace content into the caller's suite.
            // Treat "no access" the same as "not found" so the id can't be used as an existence oracle.
            if (call is null || !await accessGuard.CanAccessProjectAsync(call.Agent.Project.Id, cancellationToken))
                return NotFound($"Agent call {callId} not found.");
            // A response-less call (the upstream errored or never completed) is a client-input
            // precondition, not a server fault — return 400 like the adjacent guards above rather
            // than letting a bare InvalidOperationException fall through to a generic 500.
            if (call.Response is null)
                return BadRequest($"Agent call {callId} does not have a response and cannot be promoted to a test case.");

            var testCase = createTestCaseFromCall(call);
            var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
            testCases.Add(saved);
        }

        var suite = createSuite(request.Name, agent, evaluators, testCases);
        var savedSuite = await suiteRepository.AddAsync(suite, cancellationToken);
        var projectId = await agentRepository.GetProjectIdAsync(agent.Id, cancellationToken);
        audit.LogAudit(AuditAction.TestSuiteCreated, nameof(ITestSuite), savedSuite.Id, savedSuite.Name, projectId: projectId);
        return CreatedAtAction(nameof(Get), new { id = savedSuite.Id }, mapper.ToDto(savedSuite));
    }

    [HttpPost("{id:guid}/test-cases")]
    public async Task<ActionResult<TestSuiteDto>> AddTestCase(
        Guid id,
        [FromBody] AddTestCaseRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await suiteRepository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();
        if (!await accessGuard.CanAccessProjectAsync(existing.Agent.Project.Id, cancellationToken))
            return NotFound();

        var testCase = await BuildTestCase(request.FromAgentCallId, request.Input, request.ExpectedOutput, cancellationToken);
        if (testCase is null)
            return BadRequest("Provide either fromAgentCallId or both input and expectedOutput.");

        var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
        var updatedCases = existing.TestCases.Append(saved).ToArray();
        var updated = createSuiteExisting(existing.Name, existing.Agent, existing.Evaluators, updatedCases, existing);
        var savedSuite = await suiteRepository.UpdateAsync(updated, cancellationToken);
        var projectId = await agentRepository.GetProjectIdAsync(existing.Agent.Id, cancellationToken);
        audit.LogAudit(AuditAction.TestCaseCreated, nameof(ITestCase), saved.Id, projectId: projectId);
        return mapper.ToDto(savedSuite);
    }

    [HttpDelete("{id:guid}/test-cases/{caseId:guid}")]
    public async Task<ActionResult<TestSuiteDto>> RemoveTestCase(
        Guid id,
        Guid caseId,
        CancellationToken cancellationToken)
    {
        var existing = await suiteRepository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();
        if (!await accessGuard.CanAccessProjectAsync(existing.Agent.Project.Id, cancellationToken))
            return NotFound();
        if (existing.TestCases.All(tc => tc.Id != caseId))
            return mapper.ToDto(existing); // nothing to remove

        var updatedCases = existing.TestCases.Where(tc => tc.Id != caseId).ToArray();
        var updated = createSuiteExisting(existing.Name, existing.Agent, existing.Evaluators, updatedCases, existing);
        var saved = await suiteRepository.UpdateAsync(updated, cancellationToken);

        var projectId = await agentRepository.GetProjectIdAsync(existing.Agent.Id, cancellationToken);
        audit.LogAudit(AuditAction.TestCaseDeleted, nameof(ITestCase), caseId, projectId: projectId);
        return mapper.ToDto(saved);
    }

    private async Task<ITestCase?> BuildTestCase(
        Guid? fromAgentCallId,
        IReadOnlyList<TestSuiteMessageDto>? inputMessages,
        TestSuiteMessageDto? expectedOutput,
        CancellationToken cancellationToken)
    {
        if (fromAgentCallId.HasValue)
        {
            // Only build from a trace the caller may access; a foreign call id resolves to null here
            // and the callers map that to a generic 400 (no cross-tenant trace content disclosed).
            var call = await agentCallRepository.FindAsync(fromAgentCallId.Value, cancellationToken);
            if (call is null || !await accessGuard.CanAccessProjectAsync(call.Agent.Project.Id, cancellationToken))
                return null;
            return expectedOutput is not null
                ? createTestCase(call.Request, mapper.BuildAssistantMessage(expectedOutput))
                : createTestCaseFromCall(call);
        }

        if (inputMessages is not null && expectedOutput is not null)
        {
            var conversation = mapper.BuildConversation(inputMessages);
            var expected = mapper.BuildAssistantMessage(expectedOutput);
            return createTestCase(conversation, expected);
        }

        return null;
    }
}
