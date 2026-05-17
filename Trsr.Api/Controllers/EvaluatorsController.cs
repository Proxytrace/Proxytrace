using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Evaluators;
using Trsr.Application.Evaluator;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Inference;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/evaluators")]
public class EvaluatorsController : ControllerBase
{
    private readonly IAgent.CreateNew createAgent;
    private readonly IAgent.CreateExisting createAgentExisting;
    private readonly IEvaluatorRepository evaluatorRepository;
    private readonly IProjectRepository projectRepository;
    private readonly IModelParameters.Create createModelParameters;
    private readonly IPromptTemplate.Create createPromptTemplate;
    private readonly IAgenticEvaluator.CreateNew createAgentic;
    private readonly IAgenticEvaluator.CreateExisting createAgenticExisting;
    private readonly IExactMatchEvaluator.CreateNew createExactMatch;
    private readonly IExactMatchEvaluator.CreateExisting createExactMatchExisting;
    private readonly INumericMatchEvaluator.CreateNew createNumericMatch;
    private readonly INumericMatchEvaluator.CreateExisting createNumericMatchExisting;
    private readonly IJsonSchemaMatchEvaluator.CreateNew createJsonSchemaMatch;
    private readonly IJsonSchemaMatchEvaluator.CreateExisting createJsonSchemaMatchExisting;
    private readonly IAgenticEvaluatorPresets agenticPresets;
    private readonly ITestResultRepository testResults;
    private readonly ITransaction transaction;

    public EvaluatorsController(
        IAgent.CreateNew createAgent,
        IAgent.CreateExisting createAgentExisting,
        IEvaluatorRepository evaluatorRepository,
        IProjectRepository projectRepository,
        IModelParameters.Create createModelParameters,
        IPromptTemplate.Create createPromptTemplate,
        IAgenticEvaluator.CreateNew createAgentic,
        IAgenticEvaluator.CreateExisting createAgenticExisting,
        IExactMatchEvaluator.CreateNew createExactMatch,
        IExactMatchEvaluator.CreateExisting createExactMatchExisting,
        INumericMatchEvaluator.CreateNew createNumericMatch,
        INumericMatchEvaluator.CreateExisting createNumericMatchExisting,
        IJsonSchemaMatchEvaluator.CreateNew createJsonSchemaMatch,
        IJsonSchemaMatchEvaluator.CreateExisting createJsonSchemaMatchExisting,
        IAgenticEvaluatorPresets agenticPresets,
        ITestResultRepository testResults,
        ITransaction transaction)
    {
        this.createAgent = createAgent;
        this.createAgentExisting = createAgentExisting;
        this.evaluatorRepository = evaluatorRepository;
        this.projectRepository = projectRepository;
        this.createModelParameters = createModelParameters;
        this.createPromptTemplate = createPromptTemplate;
        this.createAgentic = createAgentic;
        this.createAgenticExisting = createAgenticExisting;
        this.createExactMatch = createExactMatch;
        this.createExactMatchExisting = createExactMatchExisting;
        this.createNumericMatch = createNumericMatch;
        this.createNumericMatchExisting = createNumericMatchExisting;
        this.createJsonSchemaMatch = createJsonSchemaMatch;
        this.createJsonSchemaMatchExisting = createJsonSchemaMatchExisting;
        this.agenticPresets = agenticPresets;
        this.testResults = testResults;
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
        return all.Select(ToDto).ToArray();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EvaluatorDetailDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await evaluatorRepository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var evaluator = await evaluatorRepository.GetAsync(id, cancellationToken);
        return ToDto(evaluator);
    }

    [HttpPost]
    public async Task<ActionResult<EvaluatorDetailDto>> Create(
        [FromBody] CreateEvaluatorRequest request,
        CancellationToken cancellationToken)
        => await transaction.InvokeAsync<ActionResult<EvaluatorDetailDto>>(async () =>
        {
            if (!await projectRepository.ContainsAsync(request.ProjectId, cancellationToken))
                return BadRequest($"Project {request.ProjectId} not found.");
            var project = await projectRepository.GetAsync(request.ProjectId, cancellationToken);

            IEvaluator evaluator;
            switch (request.Kind)
            {
                case EvaluatorKind.Agentic:
                    if (string.IsNullOrWhiteSpace(request.Name))
                        return BadRequest("Name is required for Agentic evaluators.");
                    if (string.IsNullOrWhiteSpace(request.SystemMessage))
                        return BadRequest("SystemMessage is required for Custom evaluators.");


                    var prompt = createPromptTemplate(request.Name, request.SystemMessage);
                    var agent = createAgent(
                        name:
                        request.Name,
                        prompt,
                        tools: [],
                        endpoint: project.SystemEndpoint,
                        project: project,
                        modelParameters: createModelParameters(),
                        isSystemAgent: true);
                    agent = await agent.AddAsync(cancellationToken);
                    evaluator = createAgentic(agent);
                    break;

                case EvaluatorKind.ExactMatch:
                    evaluator = createExactMatch(project);
                    break;

                case EvaluatorKind.NumericMatch:
                    if (string.IsNullOrWhiteSpace(request.ExtractionPattern))
                        return BadRequest("ExtractionPattern is required for NumericMatch evaluators.");
                    if (request.Tolerance is null)
                        return BadRequest("Tolerance is required for NumericMatch evaluators.");
                    evaluator = createNumericMatch(new Regex(request.ExtractionPattern), request.Tolerance.Value,
                        project);
                    break;

                case EvaluatorKind.JsonSchemaMatch:
                    if (string.IsNullOrWhiteSpace(request.JsonSchema))
                        return BadRequest("JsonSchema is required for JsonSchemaMatch evaluators.");
                    evaluator = createJsonSchemaMatch(request.JsonSchema, project);
                    break;

                default:
                    return BadRequest($"Unsupported evaluator kind: {request.Kind}");
            }

            var saved = await evaluatorRepository.AddAsync(evaluator, cancellationToken);
            return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
        });

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EvaluatorDetailDto>> Update(
        Guid id,
        [FromBody] UpdateEvaluatorRequest request,
        CancellationToken cancellationToken)
        => await transaction.InvokeAsync<ActionResult<EvaluatorDetailDto>>(async () =>
        {
            if (!await evaluatorRepository.ContainsAsync(id, cancellationToken))
                return NotFound();

            var existing = await evaluatorRepository.GetAsync(id, cancellationToken);
            var project = existing.Project;

            IEvaluator updated;
            switch (existing.Kind)
            {
                case EvaluatorKind.Agentic:
                {
                    IAgenticEvaluator current = (IAgenticEvaluator)existing;
                    var name = request.Name ?? current.Name;
                    var template = request.SystemMessage ?? current.Agent.SystemPrompt.Template;
                    if (string.IsNullOrWhiteSpace(name))
                        return BadRequest("Name cannot be empty.");
                    if (string.IsNullOrWhiteSpace(template))
                        return BadRequest("SystemMessage cannot be empty.");

                    var prompt = createPromptTemplate(name, template);
                    var agent = createAgentExisting(
                        name: name,
                        systemPrompt: prompt,
                        tools: current.Agent.Tools,
                        endpoint: current.Agent.Endpoint,
                        project: project,
                        modelParameters: current.Agent.ModelParameters,
                        isSystemAgent: current.Agent.IsSystemAgent,
                        existing: current.Agent);

                    await agent.UpdateAsync(cancellationToken);

                    updated = createAgenticExisting(
                        agent,
                        existing);
                    
                    break;
                }

                case EvaluatorKind.ExactMatch:
                    updated = createExactMatchExisting(project, existing);
                    break;

                case EvaluatorKind.NumericMatch:
                {
                    var current = (INumericMatchEvaluator)existing;
                    var pattern = request.ExtractionPattern ?? current.ExtractionPattern.ToString();
                    var tolerance = request.Tolerance ?? current.Tolerance;
                    if (string.IsNullOrWhiteSpace(pattern))
                        return BadRequest("ExtractionPattern cannot be empty.");
                    updated = createNumericMatchExisting(new Regex(pattern), tolerance, project, existing);
                    break;
                }

                case EvaluatorKind.JsonSchemaMatch:
                {
                    var current = (IJsonSchemaMatchEvaluator)existing;
                    var schema = request.JsonSchema ?? current.JsonSchema;
                    if (string.IsNullOrWhiteSpace(schema))
                        return BadRequest("JsonSchema cannot be empty.");
                    updated = createJsonSchemaMatchExisting(schema, project, existing);
                    break;
                }

                default:
                    return BadRequest($"Unsupported evaluator kind: {existing.Kind}");
            }

            var saved = await evaluatorRepository.UpdateAsync(updated, cancellationToken);
            return ToDto(saved);
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
        CancellationToken cancellationToken = default)
    {
        if (!await evaluatorRepository.ContainsAsync(id, cancellationToken))
            return NotFound();

        var capped = Math.Clamp(count, 1, 50);
        var recent = await testResults.GetRecentByEvaluatorAsync(id, capped, cancellationToken);

        return recent
            .Select(r =>
            {
                var evaluation = r.Evaluations.FirstOrDefault(e => e.Evaluator.Id == id);
                return new RecentEvaluationItemDto(
                    TestResultId: r.Id,
                    TestCaseId: r.TestCase.Id,
                    CaseSummary: Summarize(r.TestCase),
                    Score: evaluation?.Score?.ToString(),
                    Passed: evaluation?.Passed ?? r.Passed,
                    Reasoning: evaluation?.Reasoning,
                    LatencyMs: (int)r.Latency.TotalMilliseconds,
                    EvaluatedAt: r.UpdatedAt);
            })
            .ToArray();
    }

    private static string Summarize(ITestCase tc)
    {
        var firstUser = tc.Input.Messages.OfType<UserMessage>().FirstOrDefault();
        if (firstUser is null) return "Test case";
        var text = string.Concat(firstUser.Contents.Select(c => c.Text ?? ""));
        return text.Length > 80 ? text[..77] + "…" : text;
    }

    private static EvaluatorDetailDto ToDto(IEvaluator evaluator)
    {
        string? systemMessage = null;
        string? jsonSchema = null;
        string? extractionPattern = null;
        decimal? tolerance = null;
        Guid? agentId = null;

        switch (evaluator)
        {
            case IAgenticEvaluator agentic:
                systemMessage = agentic.Agent.SystemPrompt.Template;
                agentId = agentic.Agent.Id;
                break;
            case IJsonSchemaMatchEvaluator jsonSchemaEval:
                jsonSchema = jsonSchemaEval.JsonSchema;
                break;
            case INumericMatchEvaluator numericEval:
                extractionPattern = numericEval.ExtractionPattern.ToString();
                tolerance = numericEval.Tolerance;
                break;
        }

        var endpoint = evaluator.Project.SystemEndpoint;

        return new EvaluatorDetailDto(
            evaluator.Id,
            evaluator.Kind,
            evaluator.Name,
            systemMessage,
            evaluator.Project.Id,
            evaluator.Project.Name,
            endpoint.Id,
            endpoint.Model.Name,
            agentId,
            jsonSchema,
            extractionPattern,
            tolerance,
            evaluator.CreatedAt,
            evaluator.UpdatedAt);
    }
}
