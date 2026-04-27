using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Domain.ApiKey;

/// <summary>
/// An API key for authenticating at this app, associated with a project and a model provider.
/// </summary>
public interface IApiKey : IDomainEntity
{
    /// <summary>
    /// The name (purpose) of the api key
    /// </summary>
    string Name { get; }
    
    /// <summary>
    /// The api key
    /// </summary>
    string ApiKey { get; }
    
    /// <summary>
    /// The associated project
    /// </summary>
    IProject Project { get; }
    
    /// <summary>
    /// The model provider this api key associates with.
    /// Note: The <see cref="ApiKey"/> property is for authenticating at this app.
    /// The model provider requires a separate (different) ApiKey <see cref="IModelProvider.ApiKey"/>
    /// </summary>
    IModelProvider Provider { get; }

    /// <summary>Factory delegate for creating a new API key.</summary>
    public delegate IApiKey CreateNew(string name, string apiKey, IProject project, IModelProvider provider);

    /// <summary>Factory delegate for reconstituting an existing API key from persistence.</summary>
    public delegate IApiKey CreateExisting(string name, string apiKey, IProject project, IModelProvider provider, IDomainEntityData existing);
}