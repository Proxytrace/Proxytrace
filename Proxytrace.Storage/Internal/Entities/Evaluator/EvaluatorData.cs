namespace Proxytrace.Storage.Internal.Entities.Evaluator;

internal sealed record ExactMatchEvaluatorData;
internal sealed record AgenticEvaluatorData(Guid AgentId);
internal sealed record JsonSchemaMatchEvaluatorData(string JsonSchema);
internal sealed record NumericMatchEvaluatorData(string ExtractionPattern, decimal Tolerance);
