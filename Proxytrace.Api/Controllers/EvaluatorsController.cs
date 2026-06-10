using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Evaluators;
using Proxytrace.Api.Dto.Statistics;
using Proxytrace.Api.Evaluators;
using Proxytrace.Application.Evaluator;
using Proxytrace.Application.Statistics;
using Proxytrace.Domain;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/evaluators")]
public class EvaluatorsController : ControllerBase
{
    private readonly IEvaluatorRepository evaluatorRepository;
    private readonly IProjectRepository projectRepository;
    private readonly IAgenticEvaluatorPresets agenticPresets;
    private readonly ITestResultRepository testResults;
    private readonly ITestRunRepository testRuns;
    private readonly ITestSuiteRepository testSuites;
    private readonly IEvaluatorStatsReader evaluatorStats;
    private readonly EvaluatorBuilder evaluatorBuilder;
    private readonly EvaluatorDtoMapper evaluatorMapper;
    private readonly ITransaction transaction;

    public EvaluatorsController(
        IEvaluatorRepository evaluatorRepository,
        IProjectRepository projectRepository,
        IAgenticEvaluatorPresets agenticPresets,
        ITestResultRepository testResults,
        ITestRunRepository testRuns,
        ITestSuiteRepository testSuites,
        IEvaluatorStatsReader evaluatorStats,
        EvaluatorBuilder evaluatorBuilder,
        EvaluatorDtoMapper evaluatorMapper,
        ITransaction transaction)
    {
        this.evaluatorRepository = evaluatorRepository;
        this.projectRepository = projectRepository;
        this.agenticPresets = agenticPresets;
        this.testResults = testResults;
        this.testRuns = testRuns;
        this.testSuites = testSuites;
        this.evaluatorStats = evaluatorStats;
        this.evaluatorBuilder = evaluatorBuilder;
        this.evaluatorMapper = evaluatorMapper;
        this.transaction = transaction;
    }

    [HttpGet("agentic-presets")]
    public IReadOnlyList<AgenticEvaluatorPresetDto> GetAgenticPresets()
        => agenticPresets.GetAll()
            .Select(p => new AgenticEvaluatorPresetDto(p.Key, p.Name, p.SystemPrompt))
            .ToArray();

    [HttpGet]
    public async Task<IReadOnlyList<EvaluatorDetailDto>> GetAll(
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var all = projectId.HasValue
            ? await evaluatorRepository.GetByProjectAsync(projectId.Value, cancellationToken)
            : await evaluatorRepository.GetAllAsync(cancellationToken);
        return all.Select(evaluatorMapper.ToDto).ToArray();
    }

    [HttpGet("summaries")]
    public async Task<IReadOnlyList<EvaluatorListItemDto>> GetSummaries(
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var all = projectId.HasValue
            ? await evaluatorRepository.GetByProjectAsync(projectId.Value, cancellationToken)
            : await evaluatorRepository.GetAllAsync(cancellationToken);
        return all.Select(e => new EvaluatorListItemDto(e.Id, e.Kind, e.Name)).ToArray();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EvaluatorDetailDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var evaluator = await evaluatorRepository.FindAsync(id, cancellationToken);
        if (evaluator is null)
            return NotFound();
        return evaluatorMapper.ToDto(evaluator);
    }

    [HttpGet("overview")]
    public async Task<EvaluatorsOverviewDto> GetOverview(
        [FromQuery] Guid? projectId = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        CancellationToken cancellationToken = default)
    {
        Task<IReadOnlyList<IEvaluator>> evaluatorsTask = projectId.HasValue
            ? evaluatorRepository.GetByProjectAsync(projectId.Value, cancellationToken)
            : evaluatorRepository.GetAllAsync(cancellationToken);
        Task<IReadOnlyList<ITestSuite>> suitesTask = projectId.HasValue
            ? testSuites.GetByProjectAsync(projectId.Value, cancellationToken)
            : testSuites.GetAllAsync(cancellationToken);
        Task<IReadOnlyList<EvaluatorSparklineStat>> sparklinesTask = projectId.HasValue && from.HasValue && to.HasValue
            ? evaluatorStats.GetSparklinesAsync(projectId.Value, from.Value, to.Value, bucket, cancellationToken)
            : Task.FromResult<IReadOnlyList<EvaluatorSparklineStat>>([]);

        await Task.WhenAll(evaluatorsTask, suitesTask, sparklinesTask);

        return new EvaluatorsOverviewDto(
            Evaluators: evaluatorsTask.Result.Select(evaluatorMapper.ToDto).ToArray(),
            Suites: suitesTask.Result.Select(s => new EvaluatorSuiteRefDto(
                s.Id,
                s.Name,
                s.Agent.Id,
                s.Agent.Name,
                s.Evaluators.Select(e => e.Id).ToArray())).ToArray(),
            Sparklines: sparklinesTask.Result.Select(EvaluatorStatsDtoMapper.ToDto).ToArray());
    }

    [HttpGet("{id:guid}/detail")]
    public async Task<ActionResult<EvaluatorDetailViewDto>> GetDetailView(
        Guid id,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] StatisticsBucket bucket = StatisticsBucket.Daily,
        [FromQuery] int recentCount = 8,
        CancellationToken cancellationToken = default)
    {
        if (from is null || to is null)
            return BadRequest("Query parameters 'from' and 'to' are required.");
        if (!await evaluatorRepository.ContainsAsync(id, cancellationToken))
            return NotFound();

        var capped = Math.Clamp(recentCount, 1, 50);
        Task<EvaluatorOverviewStat> overviewTask = evaluatorStats.GetOverviewAsync(id, from.Value, to.Value, bucket, cancellationToken);
        Task<IReadOnlyList<ITestResult>> recentTask = testResults.GetRecentByEvaluatorAsync(id, capped, cancellationToken: cancellationToken);

        await Task.WhenAll(overviewTask, recentTask);

        var recent = recentTask.Result;
        var runIds = await testRuns.GetRunIdsByResultIdsAsync(recent.Select(r => r.Id).ToArray(), cancellationToken);

        return new EvaluatorDetailViewDto(
            Overview: EvaluatorStatsDtoMapper.ToDto(overviewTask.Result),
            RecentEvaluations: recent
                .Select(r => evaluatorMapper.ToRecentDto(r, id, runIds.TryGetValue(r.Id, out var runId) ? runId : null))
                .ToArray());
    }

    [HttpPost]
    public async Task<ActionResult<EvaluatorDetailDto>> Create(
        [FromBody] CreateEvaluatorRequest request,
        CancellationToken cancellationToken)
        => await transaction.InvokeAsync<ActionResult<EvaluatorDetailDto>>(async () =>
        {
            var project = await projectRepository.FindAsync(request.ProjectId, cancellationToken);
            if (project is null)
                return BadRequest($"Project {request.ProjectId} not found.");

            var evaluator = await evaluatorBuilder.BuildAsync(request, project, cancellationToken);
            var saved = await evaluatorRepository.AddAsync(evaluator, cancellationToken);
            return CreatedAtAction(nameof(Get), new { id = saved.Id }, evaluatorMapper.ToDto(saved));
        });

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EvaluatorDetailDto>> Update(
        Guid id,
        [FromBody] UpdateEvaluatorRequest request,
        CancellationToken cancellationToken)
        => await transaction.InvokeAsync<ActionResult<EvaluatorDetailDto>>(async () =>
        {
            var existing = await evaluatorRepository.FindAsync(id, cancellationToken);
            if (existing is null)
                return NotFound();

            var evaluator = await evaluatorBuilder.BuildAsync(request, existing, cancellationToken);
            var saved = await evaluatorRepository.UpdateAsync(evaluator, cancellationToken);
            return evaluatorMapper.ToDto(saved);
        });

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await evaluatorRepository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/recent-evaluations")]
    public async Task<ActionResult<IReadOnlyList<RecentEvaluationItemDto>>> RecentEvaluations(
        Guid id,
        [FromQuery] int count = 8,
        [FromQuery] EvaluationScore? score = null,
        CancellationToken cancellationToken = default)
    {
        if (!await evaluatorRepository.ContainsAsync(id, cancellationToken))
            return NotFound();

        var capped = Math.Clamp(count, 1, 50);
        var recent = await testResults.GetRecentByEvaluatorAsync(id, capped, score, cancellationToken);
        var runIds = await testRuns.GetRunIdsByResultIdsAsync(recent.Select(r => r.Id).ToArray(), cancellationToken);

        return recent
            .Select(r => evaluatorMapper.ToRecentDto(r, id, runIds.TryGetValue(r.Id, out var runId) ? runId : null))
            .ToArray();
    }
}
