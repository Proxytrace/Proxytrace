using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestRuns;
using Trsr.Api.Dto.TestSuites;
using Trsr.Application.TestRun;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
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
    private readonly IModelEndpointRepository modelEndpointRepository;
    private readonly ITestRunnerService testRunnerService;
    private readonly ITestCase.CreateNew createTestCase;
    private readonly IEvaluator.CreateNew createEvaluator;
    private readonly ITestSuite.CreateNew createSuite;
    private readonly ITestSuite.CreateExisting createSuiteExisting;

    public TestSuitesController(
        ITestSuiteRepository suiteRepository,
        IAgentRepository agentRepository,
        IAgentCallRepository agentCallRepository,
        ITestCaseRepository testCaseRepository,
        IEvaluatorRepository evaluatorRepository,
        IModelEndpointRepository modelEndpointRepository,
        ITestRunnerService testRunnerService,
        ITestCase.CreateNew createTestCase,
        IEvaluator.CreateNew createEvaluator,
        ITestSuite.CreateNew createSuite,
        ITestSuite.CreateExisting createSuiteExisting)
    {
        this.suiteRepository = suiteRepository;
        this.agentRepository = agentRepository;
        this.agentCallRepository = agentCallRepository;
        this.testCaseRepository = testCaseRepository;
        this.evaluatorRepository = evaluatorRepository;
        this.modelEndpointRepository = modelEndpointRepository;
        this.testRunnerService = testRunnerService;
        this.createTestCase = createTestCase;
        this.createEvaluator = createEvaluator;
        this.createSuite = createSuite;
        this.createSuiteExisting = createSuiteExisting;
    }

    [HttpGet]
    public async Task<PagedResult<TestSuiteDto>> GetAll(
        [FromQuery] Guid? agentId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = agentId.HasValue
            ? await suiteRepository.GetByAgentAsync(agentId.Value, cancellationToken)
            : await suiteRepository.GetAllAsync(cancellationToken);
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
        var evaluator = createEvaluator();
        var savedEvaluator = await evaluatorRepository.AddAsync(evaluator, cancellationToken);

        var testCases = new List<ITestCase>();
        foreach (var tc in request.TestCases)
        {
            var testCase = await BuildTestCase(tc.FromAgentCallId, tc.Input, tc.ExpectedOutput, cancellationToken);
            if (testCase is null)
                return BadRequest("Each test case must have either fromAgentCallId or both input and expectedOutput.");
            var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
            testCases.Add(saved);
        }

        var suite = createSuite(request.Name, agent, savedEvaluator, testCases);
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

        IEvaluator evaluator = existing.Evaluators;
        if (request.EvaluatorKind.HasValue && request.EvaluatorKind.Value != existing.Evaluators.Kind)
        {
            var newEvaluator = createEvaluator();
            evaluator = await evaluatorRepository.AddAsync(newEvaluator, cancellationToken);
        }

        IReadOnlyCollection<ITestCase> testCases = existing.TestCases;
        if (request.TestCaseIds is not null)
            testCases = await testCaseRepository.GetManyAsync(request.TestCaseIds, cancellationToken);

        var updated = createSuiteExisting(existing.Name, agent, evaluator, testCases, existing);
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
        var evaluator = createEvaluator();
        var savedEvaluator = await evaluatorRepository.AddAsync(evaluator, cancellationToken);

        var testCases = new List<ITestCase>();
        foreach (var callId in request.AgentCallIds)
        {
            if (!await agentCallRepository.ContainsAsync(callId, cancellationToken))
                return BadRequest($"Agent call {callId} not found.");

            var call = await agentCallRepository.GetAsync(callId, cancellationToken);
            var nonSystemMessages = call.Request.Messages
                .Where(m => m is not SystemMessage)
                .ToList();
            var input = new Conversation(Guid.NewGuid(), nonSystemMessages);
            var testCase = createTestCase(input, call.Response);
            var saved = await testCaseRepository.AddAsync(testCase, cancellationToken);
            testCases.Add(saved);
        }

        var suite = createSuite(request.Name, agent, savedEvaluator, testCases);
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

    [HttpPost("{id:guid}/run")]
    public async Task<ActionResult<TestRunDto>> Run(Guid id, CancellationToken cancellationToken)
    {
        if (!await suiteRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var suite = await suiteRepository.GetAsync(id, cancellationToken);

        if (suite.TestCases.Count == 0)
            return BadRequest("Cannot run a suite with no test cases.");

        var endpoints = await modelEndpointRepository.GetAllAsync(cancellationToken);
        var endpoint = endpoints.FirstOrDefault();
        if (endpoint is null)
            return BadRequest("No model endpoints are configured. Send at least one proxied LLM call first.");

        var run = await testRunnerService.RunInBackgroundAsync(suite, endpoint, cancellationToken);
        return TestRunsController.ToDto(run);
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
            var nonSystemMessages = call.Request.Messages
                .Where(m => m is not SystemMessage)
                .ToList();
            var input = new Conversation(Guid.NewGuid(), nonSystemMessages);
            return createTestCase(input, call.Response);
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
        s.Evaluators.Kind,
        s.TestCases.Select(tc => new TestCaseDto(
            tc.Id,
            tc.Input.Messages.Select(m => new TestSuiteMessageDto(m.Role.ToString().ToLower(), GetText(m))).ToArray(),
            new TestSuiteMessageDto("assistant", string.Concat(tc.ExpectedOutput.Contents.Select(c => c.Text ?? "")))
        )).ToArray(),
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
    EvaluatorKind? EvaluatorKind,
    IReadOnlyList<Guid>? TestCaseIds);
