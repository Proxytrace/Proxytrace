using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.TestSuites;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
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
    private readonly ILicenseService license;

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
        ILicenseService license)
    {
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
        this.license = license;
    }

    [HttpGet]
    public async Task<PagedResult<TestSuiteDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        PagedResult<ITestSuite> paged;
        if (agentId.HasValue)
            paged = await suiteRepository.GetByAgentPagedAsync(agentId.Value, page, pageSize, cancellationToken);
        else if (projectId.HasValue)
            paged = await suiteRepository.GetByProjectPagedAsync(projectId.Value, page, pageSize, cancellationToken);
        else
            paged = await suiteRepository.GetPagedAsync(page, pageSize, cancellationToken);
        return paged.Map(mapper.ToDto);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestSuiteDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var suite = await suiteRepository.FindAsync(id, cancellationToken);
        if (suite is null)
            return NotFound();
        return mapper.ToDto(suite);
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
        return mapper.ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await suiteRepository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
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
            if (call is null)
                return BadRequest($"Agent call {callId} not found.");
            if (call.Response is null)
            {
                throw new InvalidOperationException($"Agent call {callId} does not have a response and cannot be promoted to a test case.");
            }
            
            var testCase = createTestCaseFromCall(call);
            var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
            testCases.Add(saved);
        }

        var suite = createSuite(request.Name, agent, evaluators, testCases);
        var savedSuite = await suiteRepository.AddAsync(suite, cancellationToken);
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

        var testCase = await BuildTestCase(request.FromAgentCallId, request.Input, request.ExpectedOutput, cancellationToken);
        if (testCase is null)
            return BadRequest("Provide either fromAgentCallId or both input and expectedOutput.");

        var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
        var updatedCases = existing.TestCases.Append(saved).ToArray();
        var updated = createSuiteExisting(existing.Name, existing.Agent, existing.Evaluators, updatedCases, existing);
        var savedSuite = await suiteRepository.UpdateAsync(updated, cancellationToken);
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
        var updatedCases = existing.TestCases.Where(tc => tc.Id != caseId).ToArray();
        var updated = createSuiteExisting(existing.Name, existing.Agent, existing.Evaluators, updatedCases, existing);
        var saved = await suiteRepository.UpdateAsync(updated, cancellationToken);
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
            var call = await agentCallRepository.GetAsync(fromAgentCallId.Value, cancellationToken);
            return createTestCaseFromCall(call);
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
