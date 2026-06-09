namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// A model surfaced by upstream discovery. <paramref name="Name"/> is what the proxy/endpoint
/// uses (for Azure: the deployment id). <paramref name="PricingModelName"/> is the base model used
/// for catalog/retail price lookup (for Azure: the deployment's underlying model; else == Name).
/// </summary>
public record DiscoveredModel(string Name, string PricingModelName);
