using Trsr.Domain.Evaluator;

namespace Trsr.Storage.Internal.Entities.Evaluator;

[StoredDomainEntity(typeof(IEvaluator))]
internal record EvaluatorEntity : Entity
{
    /// <summary>
    /// <see cref="IEvaluator.Kind"/> - discriminator column for future strategy variants
    /// </summary>
    public required EvaluatorKind Kind { get; init; }
}
