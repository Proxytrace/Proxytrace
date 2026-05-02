using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal sealed record ExactMatchEvaluatorData;
internal sealed record CustomEvaluatorData(SystemMessage SystemMessage, Guid EndpointId);
internal sealed record AgenticEvaluatorData(Guid EndpointId);
internal sealed record JsonSchemaMatchEvaluatorData(string JsonSchema);
internal sealed record NumericMatchEvaluatorData(string ExtractionPattern, decimal Tolerance);
