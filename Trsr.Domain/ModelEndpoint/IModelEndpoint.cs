using Trsr.Domain.Model;
using Trsr.Domain.ModelProvider;

namespace Trsr.Domain.ModelEndpoint;

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
    /// The provider that serves the model (e.g. <c>Anthropic</c>).
    /// </summary>
    IModelProvider Provider { get; }
    
    /// <summary>
    /// Price of 1M input tokens (EUR)
    /// </summary>
    decimal InputTokenCost { get; }
    
    /// <summary>
    /// Price of 1M output tokens (EUR)
    /// </summary>
    decimal OutputTokenCost { get; }

    /// <summary>Factory delegate for creating a new model endpoint.</summary>
    public delegate IModelEndpoint CreateNew(IModel model, IModelProvider provider, decimal inputTokenCost, decimal outputTokenCost);

    /// <summary>Factory delegate for reconstituting an existing model endpoint from persistence.</summary>
    public delegate IModelEndpoint CreateExisting(IModel model, IModelProvider provider, decimal inputTokenCost, decimal outputTokenCost, IDomainEntityData existing);
}