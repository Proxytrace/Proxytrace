using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Evaluators;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/evaluators")]
public class EvaluatorsController : ControllerBase
{
    private readonly IEvaluatorRepository evaluatorRepository;
    private readonly IModelEndpointRepository modelEndpointRepository;
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
        IModelEndpointRepository modelEndpointRepository,
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
        this.modelEndpointRepository = modelEndpointRepository;
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
    public async Task<IReadOnlyList<EvaluatorDetailDto>> GetAll(CancellationToken cancellationToken)
    {
        var all = await evaluatorRepository.GetAllAsync(cancellationToken);
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
        IEvaluator evaluator;
        switch (request.Kind)
        {
            case EvaluatorKind.Custom:
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest("Name is required for Custom evaluators.");
                if (string.IsNullOrWhiteSpace(request.SystemMessage))
                    return BadRequest("SystemMessage is required for Custom evaluators.");
                if (request.EndpointId is null)
                    return BadRequest("EndpointId is required for Custom evaluators.");
                if (!await modelEndpointRepository.ContainsAsync(request.EndpointId.Value, cancellationToken))
                    return BadRequest($"Model endpoint {request.EndpointId} not found.");
                var endpoint = await modelEndpointRepository.GetAsync(request.EndpointId.Value, cancellationToken);
                var sysMsg = Message.CreateSystemMessage(request.SystemMessage);
                evaluator = createCustom(request.Name, sysMsg, endpoint);
                break;

            case EvaluatorKind.ExactMatch:
                evaluator = createExactMatch();
                break;

            case EvaluatorKind.NumericMatch:
                if (string.IsNullOrWhiteSpace(request.ExtractionPattern))
                    return BadRequest("ExtractionPattern is required for NumericMatch evaluators.");
                if (request.Tolerance is null)
                    return BadRequest("Tolerance is required for NumericMatch evaluators.");
                evaluator = createNumericMatch(new Regex(request.ExtractionPattern), request.Tolerance.Value);
                break;

            case EvaluatorKind.JsonSchemaMatch:
                if (string.IsNullOrWhiteSpace(request.JsonSchema))
                    return BadRequest("JsonSchema is required for JsonSchemaMatch evaluators.");
                evaluator = createJsonSchemaMatch(request.JsonSchema);
                break;

            case EvaluatorKind.Helpfulness:
            {
                var preset = await CreatePresetEvaluatorAsync(request, ep => createHelpfulness(ep), cancellationToken);
                if (preset is null) return BadRequest("EndpointId is required for Helpfulness evaluators.");
                evaluator = preset;
                break;
            }

            case EvaluatorKind.Politeness:
            {
                var preset = await CreatePresetEvaluatorAsync(request, ep => createPoliteness(ep), cancellationToken);
                if (preset is null) return BadRequest("EndpointId is required for Politeness evaluators.");
                evaluator = preset;
                break;
            }

            case EvaluatorKind.Safety:
            {
                var preset = await CreatePresetEvaluatorAsync(request, ep => createSafety(ep), cancellationToken);
                if (preset is null) return BadRequest("EndpointId is required for Safety evaluators.");
                evaluator = preset;
                break;
            }

            case EvaluatorKind.ToolUsage:
            {
                var preset = await CreatePresetEvaluatorAsync(request, ep => createToolUsage(ep), cancellationToken);
                if (preset is null) return BadRequest("EndpointId is required for ToolUsage evaluators.");
                evaluator = preset;
                break;
            }

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

        IEvaluator updated;
        switch (existing.Kind)
        {
            case EvaluatorKind.Custom:
            {
                var current = (ICustomEvaluator)existing;
                var name = request.Name ?? current.Name;
                var sysMsgText = request.SystemMessage
                    ?? string.Concat(current.SystemMessage.Contents.Select(c => c.Text ?? ""));
                if (string.IsNullOrWhiteSpace(name))
                    return BadRequest("Name cannot be empty.");
                if (string.IsNullOrWhiteSpace(sysMsgText))
                    return BadRequest("SystemMessage cannot be empty.");
                var endpoint = request.EndpointId.HasValue
                    ? await ResolveEndpointAsync(request.EndpointId.Value, cancellationToken)
                    : current.Endpoint;
                if (endpoint is null) return BadRequest($"Model endpoint {request.EndpointId} not found.");
                updated = createCustomExisting(name, Message.CreateSystemMessage(sysMsgText), endpoint, existing);
                break;
            }

            case EvaluatorKind.ExactMatch:
                updated = createExactMatchExisting(existing);
                break;

            case EvaluatorKind.NumericMatch:
            {
                var current = (INumericMatchEvaluator)existing;
                var pattern = request.ExtractionPattern ?? current.ExtractionPattern.ToString();
                var tolerance = request.Tolerance ?? current.Tolerance;
                if (string.IsNullOrWhiteSpace(pattern))
                    return BadRequest("ExtractionPattern cannot be empty.");
                updated = createNumericMatchExisting(new Regex(pattern), tolerance, existing);
                break;
            }

            case EvaluatorKind.JsonSchemaMatch:
            {
                var current = (IJsonSchemaMatchEvaluator)existing;
                var schema = request.JsonSchema ?? current.JsonSchema;
                if (string.IsNullOrWhiteSpace(schema))
                    return BadRequest("JsonSchema cannot be empty.");
                updated = createJsonSchemaMatchExisting(schema, existing);
                break;
            }

            case EvaluatorKind.Helpfulness:
            {
                var current = (IHelpfulnessEvaluator)existing;
                var ep = request.EndpointId.HasValue
                    ? await ResolveEndpointAsync(request.EndpointId.Value, cancellationToken)
                    : current.Endpoint;
                if (ep is null) return BadRequest($"Model endpoint {request.EndpointId} not found.");
                updated = createHelpfulnessExisting(ep, existing);
                break;
            }

            case EvaluatorKind.Politeness:
            {
                var current = (IPolitenessEvaluator)existing;
                var ep = request.EndpointId.HasValue
                    ? await ResolveEndpointAsync(request.EndpointId.Value, cancellationToken)
                    : current.Endpoint;
                if (ep is null) return BadRequest($"Model endpoint {request.EndpointId} not found.");
                updated = createPolitenessExisting(ep, existing);
                break;
            }

            case EvaluatorKind.Safety:
            {
                var current = (ISafetyClassifier)existing;
                var ep = request.EndpointId.HasValue
                    ? await ResolveEndpointAsync(request.EndpointId.Value, cancellationToken)
                    : current.Endpoint;
                if (ep is null) return BadRequest($"Model endpoint {request.EndpointId} not found.");
                updated = createSafetyExisting(ep, existing);
                break;
            }

            case EvaluatorKind.ToolUsage:
            {
                var current = (IToolUsageEvaluator)existing;
                var ep = request.EndpointId.HasValue
                    ? await ResolveEndpointAsync(request.EndpointId.Value, cancellationToken)
                    : current.Endpoint;
                if (ep is null) return BadRequest($"Model endpoint {request.EndpointId} not found.");
                updated = createToolUsageExisting(ep, existing);
                break;
            }

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

    private async Task<IModelEndpoint?> ResolveEndpointAsync(Guid endpointId, CancellationToken cancellationToken)
    {
        if (!await modelEndpointRepository.ContainsAsync(endpointId, cancellationToken)) return null;
        return await modelEndpointRepository.GetAsync(endpointId, cancellationToken);
    }

    private async Task<IEvaluator?> CreatePresetEvaluatorAsync(
        CreateEvaluatorRequest request,
        Func<IModelEndpoint, IEvaluator> factory,
        CancellationToken cancellationToken)
    {
        if (request.EndpointId is null) return null;
        if (!await modelEndpointRepository.ContainsAsync(request.EndpointId.Value, cancellationToken)) return null;
        var ep = await modelEndpointRepository.GetAsync(request.EndpointId.Value, cancellationToken);
        return factory(ep);
    }

    internal static EvaluatorDetailDto ToDto(IEvaluator evaluator)
    {
        string? systemMessage = null;
        Guid? endpointId = null;
        string? endpointName = null;
        string? jsonSchema = null;
        string? extractionPattern = null;
        decimal? tolerance = null;

        switch (evaluator)
        {
            case ICustomEvaluator custom:
                systemMessage = string.Concat(custom.SystemMessage.Contents.Select(c => c.Text ?? ""));
                endpointId = custom.Endpoint.Id;
                endpointName = custom.Endpoint.Model.Name;
                break;
            case IAgenticEvaluator agentic:
                endpointId = agentic.Endpoint.Id;
                endpointName = agentic.Endpoint.Model.Name;
                break;
            case IJsonSchemaMatchEvaluator jsonSchemaEval:
                jsonSchema = jsonSchemaEval.JsonSchema;
                break;
            case INumericMatchEvaluator numericEval:
                extractionPattern = numericEval.ExtractionPattern.ToString();
                tolerance = numericEval.Tolerance;
                break;
        }

        return new EvaluatorDetailDto(
            evaluator.Id,
            evaluator.Kind,
            GetName(evaluator),
            systemMessage,
            endpointId,
            endpointName,
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
