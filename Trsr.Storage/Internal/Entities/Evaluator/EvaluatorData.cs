using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.Evaluator;

internal sealed record ExactMatchEvaluatorData;

internal sealed record AgenticEvaluatorData
{
    public required SystemMessage SystemMessage { get; init; }
    public required Guid EndpointId { get; init; }
}
