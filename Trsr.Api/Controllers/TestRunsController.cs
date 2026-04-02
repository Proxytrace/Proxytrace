using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.TestRuns;
using Trsr.Api.Services;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/test-runs")]
public class TestRunsController : ControllerBase
{
    private readonly ITestRunRepository repository;
    private readonly ITestSuiteRepository suiteRepository;
    private readonly ITestRunnerService runner;

    public TestRunsController(
        ITestRunRepository repository,
        ITestSuiteRepository suiteRepository,
        ITestRunnerService runner)
    {
        this.repository = repository;
        this.suiteRepository = suiteRepository;
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
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
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
        var run = await runner.RunAsync(suite, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = run.Id }, ToDto(run));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static TestRunDto ToDto(ITestRun r) => new(
        r.Id,
        r.Agent.Id,
        r.Timestamp,
        r.TestResults.Select(result => new TestResultDto(
            result.Id,
            result.TestCase.Id,
            new MessageDto("assistant", string.Concat(result.ActualResponse.Contents.Select(c => c.Text ?? ""))),
            result.Evaluation
        )).ToArray(),
        r.CreatedAt,
        r.UpdatedAt);
}
