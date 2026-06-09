namespace Proxytrace.Domain.ModelProvider;

/// <summary>Runtime classification of a provider by its endpoint, without changing the entity.</summary>
public static class ProviderEndpoints
{
    /// <summary>True when the endpoint host indicates an Azure OpenAI resource.</summary>
    public static bool IsAzure(Uri endpoint) =>
        endpoint.Host.Contains("azure.com", StringComparison.OrdinalIgnoreCase);
}
