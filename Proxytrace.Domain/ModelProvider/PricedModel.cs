using Proxytrace.Domain.Model;

namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// A model discovered from a provider together with its resolved price (EUR / 1M tokens). Returned
/// by <see cref="IProviderClient.GetModelsAsync"/>; the price is <see cref="ModelPrice.Unknown"/>
/// when it could not be resolved.
/// </summary>
public record PricedModel(IModel Model, ModelPrice Price);
