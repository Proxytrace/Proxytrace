using Trsr.Domain.Evaluator;

namespace Trsr.Api.Dto.Evaluators;

public record EvaluatorDetailDto(
    Guid Id,
    EvaluatorKind Kind,
    string Name,
    string? SystemMessage,
    Guid? EndpointId,
    string? EndpointName,
    string? JsonSchema,
    string? ExtractionPattern,
    decimal? Tolerance,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateEvaluatorRequest(
    EvaluatorKind Kind,
    string? Name,
    string? SystemMessage,
    Guid? EndpointId,
    string? JsonSchema,
    string? ExtractionPattern,
    decimal? Tolerance);

public record UpdateEvaluatorRequest(
    string? Name,
    string? SystemMessage,
    Guid? EndpointId,
    string? JsonSchema,
    string? ExtractionPattern,
    decimal? Tolerance);
