using Trsr.Domain.Evaluator;

namespace Trsr.Api.Dto.Evaluators;

public record EvaluatorDetailDto(
    Guid Id,
    EvaluatorKind Kind,
    string Name,
    string? SystemMessage,
    Guid ProjectId,
    string ProjectName,
    Guid? EndpointId,
    string? EndpointName,
    string? JsonSchema,
    string? ExtractionPattern,
    decimal? Tolerance,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateEvaluatorRequest(
    EvaluatorKind Kind,
    Guid ProjectId,
    string? Name,
    string? SystemMessage,
    string? JsonSchema,
    string? ExtractionPattern,
    decimal? Tolerance);

public record UpdateEvaluatorRequest(
    string? Name,
    string? SystemMessage,
    string? JsonSchema,
    string? ExtractionPattern,
    decimal? Tolerance);
