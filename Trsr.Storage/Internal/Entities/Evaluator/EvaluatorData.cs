using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal sealed record ExactMatchEvaluatorData;
internal sealed record CustomEvaluatorData(SystemMessage SystemMessage, Guid EndpointId);
internal sealed record HelpfulnessEvaluatorData(Guid EndpointId);