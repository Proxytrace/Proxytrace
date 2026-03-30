using Trsr.Domain.Evaluator;

namespace Trsr.Storage.Internal.Entities.Evaluator;

[StoredDomainEntity(typeof(IEvaluator))]
internal record EvaluatorEntity : Entity, IEvaluatorData
{
    /// <summary>
    /// <see cref="IEvaluator.Kind"/> - stored as discriminator column for future strategy variants
    /// </summary>
    public required EvaluatorKind Kind { get; init; }
}
