using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestRuns;
using Trsr.Api.Services;
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
    private readonly ITestRunRepository repository;
    private readonly ITestSuiteRepository suiteRepository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly ITestRunnerService runner;

    public TestRunsController(
        ITestRunRepository repository,
        ITestSuiteRepository suiteRepository,
        IRepository<IModelEndpoint> endpoints,
        ITestRunnerService runner)
    {
        this.repository = repository;
        this.suiteRepository = suiteRepository;
        this.endpoints = endpoints;
        this.runner = runner;
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
        var run = await runner.StartAsync(suite, endpoint, cancellationToken);
        return AcceptedAtAction(nameof(Get), new { id = run.Id }, ToDto(run));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    internal static TestRunDto ToDto(ITestRun r)
    {
        var passed = r.TestResults.Count(x => x.Evaluation == Evaluation.Pass);
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
                res.Evaluation,
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
