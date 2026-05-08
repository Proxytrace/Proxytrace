using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestSuites;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Controllers;

[ApiController]
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
        ITestSuite.CreateExisting createSuiteExisting)
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
    }

    [HttpGet]
    public async Task<PagedResult<TestSuiteDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestSuite> all;
        if (agentId.HasValue)
            all = await suiteRepository.GetByAgentAsync(agentId.Value, cancellationToken);
        else if (projectId.HasValue)
            all = await suiteRepository.GetByProjectAsync(projectId.Value, cancellationToken);
        else
            all = await suiteRepository.GetAllAsync(cancellationToken);
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
        return new PagedResult<TestSuiteDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TestSuiteDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var suite = await suiteRepository.GetAsync(id, cancellationToken);
        return ToDto(suite);
    }

    [HttpPost]
    public async Task<ActionResult<TestSuiteDto>> Create(
        [FromBody] CreateTestSuiteRequest request,
        CancellationToken cancellationToken)
    {
        if (!await agentRepository.ContainsAsync(request.AgentId, cancellationToken))
            return BadRequest($"Agent {request.AgentId} not found.");
        var agent = await agentRepository.GetAsync(request.AgentId, cancellationToken);

        IReadOnlyCollection<IEvaluator> evaluators;
        if (request.EvaluatorIds is { Count: > 0 })
        {
            evaluators = await evaluatorRepository.GetManyAsync(request.EvaluatorIds, cancellationToken);
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
        return CreatedAtAction(nameof(Get), new { id = savedSuite.Id }, ToDto(savedSuite));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TestSuiteDto>> Update(
        Guid id,
        [FromBody] UpdateTestSuiteRequest request,
        CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await suiteRepository.GetAsync(id, cancellationToken);

        var agent = request.AgentId.HasValue && request.AgentId.Value != existing.Agent.Id
            ? await agentRepository.GetAsync(request.AgentId.Value, cancellationToken)
            : existing.Agent;

        IReadOnlyCollection<IEvaluator> evaluators = existing.Evaluators;
        if (request.EvaluatorIds is not null)
            evaluators = await evaluatorRepository.GetManyAsync(request.EvaluatorIds, cancellationToken);

        IReadOnlyCollection<ITestCase> testCases = existing.TestCases;
        if (request.TestCaseIds is not null)
            testCases = await testCaseRepository.GetManyAsync(request.TestCaseIds, cancellationToken);

        var updated = createSuiteExisting(existing.Name, agent, evaluators, testCases, existing);
        var saved = await suiteRepository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
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
        if (!await agentRepository.ContainsAsync(request.AgentId, cancellationToken))
            return BadRequest($"Agent {request.AgentId} not found.");

        if (request.AgentCallIds.Count == 0)
            return BadRequest("At least one agent call ID must be provided.");
        
        var agent = await agentRepository.GetAsync(request.AgentId, cancellationToken);
        var evaluator = createEvaluator(agent.Project);
        var savedEvaluator = await evaluatorRepository.AddAsync(evaluator, cancellationToken);

        var testCases = new List<ITestCase>();
        foreach (var callId in request.AgentCallIds)
        {
            if (!await agentCallRepository.ContainsAsync(callId, cancellationToken))
                return BadRequest($"Agent call {callId} not found.");

            var call = await agentCallRepository.GetAsync(callId, cancellationToken);
            if (call.Response is null)
            {
                throw new InvalidOperationException($"Agent call {callId} does not have a response and cannot be promoted to a test case.");
            }
            
            var testCase = createTestCaseFromCall(call);
            var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
            testCases.Add(saved);
        }

        var suite = createSuite(request.Name, agent, [savedEvaluator], testCases);
        var savedSuite = await suiteRepository.AddAsync(suite, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = savedSuite.Id }, ToDto(savedSuite));
    }

    [HttpPost("{id:guid}/test-cases")]
    public async Task<ActionResult<TestSuiteDto>> AddTestCase(
        Guid id,
        [FromBody] AddTestCaseRequest request,
        CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await suiteRepository.GetAsync(id, cancellationToken);

        var testCase = await BuildTestCase(request.FromAgentCallId, request.Input, request.ExpectedOutput, cancellationToken);
        if (testCase is null)
            return BadRequest("Provide either fromAgentCallId or both input and expectedOutput.");

        var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
        var updatedCases = existing.TestCases.Append(saved).ToArray();
        var updated = createSuiteExisting(existing.Name, existing.Agent, existing.Evaluators, updatedCases, existing);
        var savedSuite = await suiteRepository.UpdateAsync(updated, cancellationToken);
        return ToDto(savedSuite);
    }

    [HttpDelete("{id:guid}/test-cases/{caseId:guid}")]
    public async Task<ActionResult<TestSuiteDto>> RemoveTestCase(
        Guid id,
        Guid caseId,
        CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await suiteRepository.GetAsync(id, cancellationToken);
        var updatedCases = existing.TestCases.Where(tc => tc.Id != caseId).ToArray();
        var updated = createSuiteExisting(existing.Name, existing.Agent, existing.Evaluators, updatedCases, existing);
        var saved = await suiteRepository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
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
            var conversation = BuildConversation(inputMessages);
            var expected = BuildAssistantMessage(expectedOutput);
            return createTestCase(conversation, expected);
        }

        return null;
    }

    private static Conversation BuildConversation(IReadOnlyList<TestSuiteMessageDto> messages)
    {
        var msgs = new List<Message>();
        foreach (var m in messages)
        {
            Message msg = m.Role.ToLower() switch
            {
                "user" => new UserMessage([Domain.Message.Content.FromText(m.Content)]),
                "assistant" => new AssistantMessage([Domain.Message.Content.FromText(m.Content)], []),
                "system" => new SystemMessage([Domain.Message.Content.FromText(m.Content)]),
                _ => new UserMessage([Domain.Message.Content.FromText(m.Content)])
            };
            msgs.Add(msg);
        }
        return new Conversation(Guid.NewGuid(), msgs);
    }

    private static AssistantMessage BuildAssistantMessage(TestSuiteMessageDto m)
        => new([Domain.Message.Content.FromText(m.Content)], []);

    private static TestSuiteDto ToDto(ITestSuite s) => new(
        s.Id,
        s.Name,
        s.Agent.Id,
        s.Agent.Name,
        s.Evaluators.Select(e => new EvaluatorDto(e.Id, e.Kind)).ToArray(),
        s.TestCases.Select(tc => new TestCaseDto(
            tc.Id,
            tc.Input.Messages.Select(m => new TestSuiteMessageDto(m.Role.ToString().ToLower(), GetText(m))).ToArray(),
            new TestSuiteMessageDto("assistant", string.Concat(tc.ExpectedOutput.Contents.Select(c => c.Text ?? "")))
        )).ToArray(),
        Description: null,
        Tags: [],
        TotalRuns: 0,
        PassRate: null,
        PrevPassRate: null,
        PassRateTrend: [],
        LastRunAt: null,
        LastRunGroupId: null,
        s.CreatedAt,
        s.UpdatedAt);

    private static string GetText(Message m) => m switch
    {
        UserMessage u => string.Concat(u.Contents.Select(c => c.Text ?? "")),
        AssistantMessage a => string.Concat(a.Contents.Select(c => c.Text ?? "")),
        SystemMessage sys => string.Concat(sys.Contents.Select(c => c.Text ?? "")),
        _ => ""
    };
}

public record UpdateTestSuiteRequest(
    Guid? AgentId,
    IReadOnlyList<Guid>? EvaluatorIds,
    IReadOnlyList<Guid>? TestCaseIds);
