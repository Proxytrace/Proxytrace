namespace Trsr.Domain.ModelProvider;

public interface IModelProvider
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
}