using Proxytrace.Domain.Evaluator;

namespace Proxytrace.Api.Dto.Evaluators;

public record EvaluatorDetailDto(
    Guid Id,
    EvaluatorKind Kind,
    string Name,
    string? SystemMessage,
    Guid ProjectId,
    string ProjectName,
    Guid? EndpointId,
    string? EndpointName,
    Guid? AgentId,
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

public record AgenticEvaluatorPresetDto(string Key, string Name, string SystemPrompt);
