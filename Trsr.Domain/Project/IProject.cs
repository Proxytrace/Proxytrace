using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Project;

/// <summary>
/// Represents a project within an organization that owns agents and test suites.
/// </summary>
public interface IProject : IDomainEntity
{
    /// <summary>The display name of the project.</summary>
    string Name { get; }
    
    /// <summary>
    /// Endpoint for system agents (e.g. model name generation or optimizers)
    /// </summary>
    IModelEndpoint SystemEndpoint { get; }

    /// <summary>Factory delegate for creating a new project.</summary>
    public delegate IProject CreateNew(
        string name,
        IModelEndpoint systemEndpoint);

    /// <summary>Factory delegate for reconstituting an existing project from persistence.</summary>
    public delegate IProject CreateExisting(
        string name,
        IModelEndpoint systemEndpoint,
        IDomainEntityData existing);
}
