using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.ModelEndpoint;

/// <summary>
/// A model endpoint (<see cref="IModel"/> + <see cref="IModelProvider"/>)
/// </summary>
public interface IModelEndpoint : IDomainEntity
{
    /// <summary>
    /// The language model
    /// </summary>
    IModel Model { get; }
    
    /// <summary>
    /// The provider that serves the model (e.g. <c>OpenAI</c>).
    /// </summary>
    IModelProvider Provider { get; }
    
    /// <summary>
    /// Price of 1M input tokens (EUR), or <c>null</c> if not configured.
    /// </summary>
    decimal? InputTokenCost { get; }

    /// <summary>
    /// Price of 1M output tokens (EUR), or <c>null</c> if not configured.
    /// </summary>
    decimal? OutputTokenCost { get; }

    /// <summary>Factory delegate for creating a new model endpoint.</summary>
    public delegate IModelEndpoint CreateNew(
        IModel model,
        IModelProvider provider,
        decimal? inputTokenCost,
        decimal? outputTokenCost);

    /// <summary>Factory delegate for reconstituting an existing model endpoint from persistence.</summary>
    public delegate IModelEndpoint CreateExisting(
        IModel model, 
        IModelProvider provider, 
        decimal? inputTokenCost,
        decimal? outputTokenCost, 
        IDomainEntityData existing);

    /// <summary>
    /// Calculates cost associated with this endpoint for a given usage
    /// </summary>
    decimal? CalculateCost(TokenUsage usage);
}