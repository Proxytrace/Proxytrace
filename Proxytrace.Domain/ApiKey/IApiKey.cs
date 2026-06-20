using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Domain.ApiKey;

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

    /// <summary>
    /// The capabilities this key grants. The ingestion proxy requires <see cref="ApiKeyScopes.Ingestion"/>;
    /// the MCP server requires <see cref="ApiKeyScopes.McpRead"/> (and <see cref="ApiKeyScopes.McpWrite"/>
    /// for its write tools). Keys are scoped per least privilege.
    /// </summary>
    ApiKeyScopes Scopes { get; }

    /// <summary>
    /// The user this key acts as. Every MCP call made with the key runs in this user's context, so its
    /// actions are attributed to them.
    /// </summary>
    IUser Owner { get; }

    /// <summary>Factory delegate for creating a new API key.</summary>
    public delegate IApiKey CreateNew(string name, string apiKey, IProject project, IModelProvider provider, ApiKeyScopes scopes, IUser owner);

    /// <summary>Factory delegate for reconstituting an existing API key from persistence.</summary>
    public delegate IApiKey CreateExisting(string name, string apiKey, IProject project, IModelProvider provider, ApiKeyScopes scopes, IUser owner, IDomainEntityData existing);
}