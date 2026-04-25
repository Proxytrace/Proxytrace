namespace Trsr.Domain.ModelProvider;

/// <summary>
/// A model provider (e.g. Anthropic, OpenAI) with its API endpoint and credentials.
/// </summary>
public interface IModelProvider : IDomainEntity
{
    /// <summary>
    /// The name of the model provider (e.g. Anthropic)
    /// </summary>
    string Name { get; }
    
    /// <summary>
    /// The endpoint URL for the model provider's API (e.g. https://api.anthropic.com/v1)
    /// </summary>
    Uri Endpoint { get; }

    /// <summary>
    /// The API key
    /// </summary>
    string ApiKey { get; }

    /// <summary>Factory delegate for creating a new model provider.</summary>
    public delegate IModelProvider CreateNew(string name, Uri endpoint, string apiKey);

    /// <summary>Factory delegate for reconstituting an existing model provider from persistence.</summary>
    public delegate IModelProvider CreateExisting(string name, Uri endpoint, string apiKey, IDomainEntityData existing);
}