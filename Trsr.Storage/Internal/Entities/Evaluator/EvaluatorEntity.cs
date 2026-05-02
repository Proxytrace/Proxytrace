using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.Evaluator;

[StoredDomainEntity(typeof(IEvaluator))]
internal record EvaluatorEntity : Entity
{
    /// <summary>
    /// <see cref="IEvaluator.Kind"/> - discriminator column for evaluator variants
    /// </summary>
    public required EvaluatorKind Kind { get; init; }
}
