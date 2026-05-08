using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Evaluators;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/evaluators")]
public class EvaluatorsController : ControllerBase
{
    private readonly IEvaluatorRepository evaluatorRepository;
    private readonly IProjectRepository projectRepository;
    private readonly IPromptTemplate.Create createPromptTemplate;
    private readonly ICustomEvaluator.CreateNew createCustom;
    private readonly ICustomEvaluator.CreateExisting createCustomExisting;
    private readonly IExactMatchEvaluator.CreateNew createExactMatch;
    private readonly IExactMatchEvaluator.CreateExisting createExactMatchExisting;
    private readonly INumericMatchEvaluator.CreateNew createNumericMatch;
    private readonly INumericMatchEvaluator.CreateExisting createNumericMatchExisting;
    private readonly IJsonSchemaMatchEvaluator.CreateNew createJsonSchemaMatch;
    private readonly IJsonSchemaMatchEvaluator.CreateExisting createJsonSchemaMatchExisting;
    private readonly IHelpfulnessEvaluator.CreateNew createHelpfulness;
    private readonly IHelpfulnessEvaluator.CreateExisting createHelpfulnessExisting;
    private readonly IPolitenessEvaluator.CreateNew createPoliteness;
    private readonly IPolitenessEvaluator.CreateExisting createPolitenessExisting;
    private readonly ISafetyClassifier.CreateNew createSafety;
    private readonly ISafetyClassifier.CreateExisting createSafetyExisting;
    private readonly IToolUsageEvaluator.CreateNew createToolUsage;
    private readonly IToolUsageEvaluator.CreateExisting createToolUsageExisting;

    public EvaluatorsController(
        IEvaluatorRepository evaluatorRepository,
        IProjectRepository projectRepository,
        IPromptTemplate.Create createPromptTemplate,
        ICustomEvaluator.CreateNew createCustom,
        ICustomEvaluator.CreateExisting createCustomExisting,
        IExactMatchEvaluator.CreateNew createExactMatch,
        IExactMatchEvaluator.CreateExisting createExactMatchExisting,
        INumericMatchEvaluator.CreateNew createNumericMatch,
        INumericMatchEvaluator.CreateExisting createNumericMatchExisting,
        IJsonSchemaMatchEvaluator.CreateNew createJsonSchemaMatch,
        IJsonSchemaMatchEvaluator.CreateExisting createJsonSchemaMatchExisting,
        IHelpfulnessEvaluator.CreateNew createHelpfulness,
        IHelpfulnessEvaluator.CreateExisting createHelpfulnessExisting,
        IPolitenessEvaluator.CreateNew createPoliteness,
        IPolitenessEvaluator.CreateExisting createPolitenessExisting,
        ISafetyClassifier.CreateNew createSafety,
        ISafetyClassifier.CreateExisting createSafetyExisting,
        IToolUsageEvaluator.CreateNew createToolUsage,
        IToolUsageEvaluator.CreateExisting createToolUsageExisting)
    {
        this.evaluatorRepository = evaluatorRepository;
        this.projectRepository = projectRepository;
        this.createPromptTemplate = createPromptTemplate;
        this.createCustom = createCustom;
        this.createCustomExisting = createCustomExisting;
        this.createExactMatch = createExactMatch;
        this.createExactMatchExisting = createExactMatchExisting;
        this.createNumericMatch = createNumericMatch;
        this.createNumericMatchExisting = createNumericMatchExisting;
        this.createJsonSchemaMatch = createJsonSchemaMatch;
        this.createJsonSchemaMatchExisting = createJsonSchemaMatchExisting;
        this.createHelpfulness = createHelpfulness;
        this.createHelpfulnessExisting = createHelpfulnessExisting;
        this.createPoliteness = createPoliteness;
        this.createPolitenessExisting = createPolitenessExisting;
        this.createSafety = createSafety;
        this.createSafetyExisting = createSafetyExisting;
        this.createToolUsage = createToolUsage;
        this.createToolUsageExisting = createToolUsageExisting;
    }

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
    {
        if (!await projectRepository.ContainsAsync(request.ProjectId, cancellationToken))
            return BadRequest($"Project {request.ProjectId} not found.");
        var project = await projectRepository.GetAsync(request.ProjectId, cancellationToken);

        IEvaluator evaluator;
        switch (request.Kind)
        {
            case EvaluatorKind.Custom:
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest("Name is required for Custom evaluators.");
                if (string.IsNullOrWhiteSpace(request.SystemMessage))
                    return BadRequest("SystemMessage is required for Custom evaluators.");
                evaluator = createCustom(createPromptTemplate(request.Name, request.SystemMessage), project);
                break;

            case EvaluatorKind.ExactMatch:
                evaluator = createExactMatch(project);
                break;

            case EvaluatorKind.NumericMatch:
                if (string.IsNullOrWhiteSpace(request.ExtractionPattern))
                    return BadRequest("ExtractionPattern is required for NumericMatch evaluators.");
                if (request.Tolerance is null)
                    return BadRequest("Tolerance is required for NumericMatch evaluators.");
                evaluator = createNumericMatch(new Regex(request.ExtractionPattern), request.Tolerance.Value, project);
                break;

            case EvaluatorKind.JsonSchemaMatch:
                if (string.IsNullOrWhiteSpace(request.JsonSchema))
                    return BadRequest("JsonSchema is required for JsonSchemaMatch evaluators.");
                evaluator = createJsonSchemaMatch(request.JsonSchema, project);
                break;

            case EvaluatorKind.Helpfulness:
                evaluator = createHelpfulness(project);
                break;

            case EvaluatorKind.Politeness:
                evaluator = createPoliteness(project);
                break;

            case EvaluatorKind.Safety:
                evaluator = createSafety(project);
                break;

            case EvaluatorKind.ToolUsage:
                evaluator = createToolUsage(project);
                break;

            default:
                return BadRequest($"Unsupported evaluator kind: {request.Kind}");
        }

        var saved = await evaluatorRepository.AddAsync(evaluator, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EvaluatorDetailDto>> Update(
        Guid id,
        [FromBody] UpdateEvaluatorRequest request,
        CancellationToken cancellationToken)
    {
        if (!await evaluatorRepository.ContainsAsync(id, cancellationToken))
            return NotFound();

        var existing = await evaluatorRepository.GetAsync(id, cancellationToken);
        var project = existing.Project;

        IEvaluator updated;
        switch (existing.Kind)
        {
            case EvaluatorKind.Custom:
            {
                var current = (ICustomEvaluator)existing;
                var name = request.Name ?? current.Name;
                var template = request.SystemMessage ?? current.SystemPrompt.Template;
                if (string.IsNullOrWhiteSpace(name))
                    return BadRequest("Name cannot be empty.");
                if (string.IsNullOrWhiteSpace(template))
                    return BadRequest("SystemMessage cannot be empty.");
                updated = createCustomExisting(createPromptTemplate(name, template), project, existing);
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

            case EvaluatorKind.Helpfulness:
                updated = createHelpfulnessExisting(project, existing);
                break;

            case EvaluatorKind.Politeness:
                updated = createPolitenessExisting(project, existing);
                break;

            case EvaluatorKind.Safety:
                updated = createSafetyExisting(project, existing);
                break;

            case EvaluatorKind.ToolUsage:
                updated = createToolUsageExisting(project, existing);
                break;

            default:
                return BadRequest($"Unsupported evaluator kind: {existing.Kind}");
        }

        var saved = await evaluatorRepository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await evaluatorRepository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    internal static EvaluatorDetailDto ToDto(IEvaluator evaluator)
    {
        string? systemMessage = null;
        string? jsonSchema = null;
        string? extractionPattern = null;
        decimal? tolerance = null;

        switch (evaluator)
        {
            case ICustomEvaluator custom:
                systemMessage = custom.SystemPrompt.Template;
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
            GetName(evaluator),
            systemMessage,
            evaluator.Project.Id,
            evaluator.Project.Name,
            endpoint.Id,
            endpoint.Model.Name,
            jsonSchema,
            extractionPattern,
            tolerance,
            evaluator.CreatedAt,
            evaluator.UpdatedAt);
    }

    private static string GetName(IEvaluator evaluator) => evaluator switch
    {
        ICustomEvaluator custom => custom.Name,
        _ => evaluator.Kind switch
        {
            EvaluatorKind.ExactMatch => "Exact Match",
            EvaluatorKind.NumericMatch => "Numeric Match",
            EvaluatorKind.Helpfulness => "Helpfulness",
            EvaluatorKind.Politeness => "Politeness",
            EvaluatorKind.JsonSchemaMatch => "JSON Schema Match",
            EvaluatorKind.Safety => "Safety Classifier",
            EvaluatorKind.ToolUsage => "Tool Usage",
            _ => evaluator.Kind.ToString()
        }
    };
}
