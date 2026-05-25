using Proxytrace.Domain.Evaluator;

namespace Proxytrace.Storage.Internal.Entities.Evaluator;

[StoredDomainEntity(typeof(IEvaluator))]
[Cacheable]
internal record EvaluatorEntity : Entity
{
    /// <summary>
    /// <see cref="IEvaluator.Kind"/> — discriminator for deserialization
    /// </summary>
    public required EvaluatorKind Kind { get; init; }
    
    public required Guid Project { get; init; }

    /// <summary>
    /// Kind-specific JSON payload. Shape is determined by <see cref="Kind"/>.
    /// </summary>
    public required string Data { get; init; }
}
