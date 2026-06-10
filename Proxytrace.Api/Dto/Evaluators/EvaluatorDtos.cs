using System.Text.Json.Serialization;
using Proxytrace.Domain.Evaluator;

namespace Proxytrace.Api.Dto.Evaluators;

/// <summary>
/// Lightweight evaluator projection for pickers / select lists — id, kind, name only.
/// Avoids shipping the full <see cref="EvaluatorDetailDto"/> (system message, JSON schema, …)
/// when a caller only needs to render and choose an evaluator.
/// </summary>
public record EvaluatorListItemDto(Guid Id, EvaluatorKind Kind, string Name);

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

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(CreateAgenticEvaluatorRequest), nameof(EvaluatorKind.Agentic))]
[JsonDerivedType(typeof(CreateExactMatchEvaluatorRequest), nameof(EvaluatorKind.ExactMatch))]
[JsonDerivedType(typeof(CreateNumericMatchEvaluatorRequest), nameof(EvaluatorKind.NumericMatch))]
[JsonDerivedType(typeof(CreateJsonSchemaMatchEvaluatorRequest), nameof(EvaluatorKind.JsonSchemaMatch))]
public abstract record CreateEvaluatorRequest
{
    public required Guid ProjectId { get; init; }
}

public sealed record CreateAgenticEvaluatorRequest : CreateEvaluatorRequest
{
    public required string Name { get; init; }
    public required string SystemMessage { get; init; }
}

public sealed record CreateExactMatchEvaluatorRequest : CreateEvaluatorRequest;

public sealed record CreateNumericMatchEvaluatorRequest : CreateEvaluatorRequest
{
    public required string ExtractionPattern { get; init; }
    public required decimal Tolerance { get; init; }
}

public sealed record CreateJsonSchemaMatchEvaluatorRequest : CreateEvaluatorRequest
{
    public required string JsonSchema { get; init; }
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(UpdateAgenticEvaluatorRequest), nameof(EvaluatorKind.Agentic))]
[JsonDerivedType(typeof(UpdateExactMatchEvaluatorRequest), nameof(EvaluatorKind.ExactMatch))]
[JsonDerivedType(typeof(UpdateNumericMatchEvaluatorRequest), nameof(EvaluatorKind.NumericMatch))]
[JsonDerivedType(typeof(UpdateJsonSchemaMatchEvaluatorRequest), nameof(EvaluatorKind.JsonSchemaMatch))]
public abstract record UpdateEvaluatorRequest;

public sealed record UpdateAgenticEvaluatorRequest : UpdateEvaluatorRequest
{
    public string? Name { get; init; }
    public string? SystemMessage { get; init; }
}

public sealed record UpdateExactMatchEvaluatorRequest : UpdateEvaluatorRequest;

public sealed record UpdateNumericMatchEvaluatorRequest : UpdateEvaluatorRequest
{
    public string? ExtractionPattern { get; init; }
    public decimal? Tolerance { get; init; }
}

public sealed record UpdateJsonSchemaMatchEvaluatorRequest : UpdateEvaluatorRequest
{
    public string? JsonSchema { get; init; }
}

public record AgenticEvaluatorPresetDto(string Key, string Name, string SystemPrompt);
