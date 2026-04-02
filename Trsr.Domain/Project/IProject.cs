using Trsr.Domain.Organization;

namespace Trsr.Domain.Project;

/// <summary>
/// Represents a project within an organization that owns agents and test suites.
/// </summary>
public interface IProject : IDomainEntity
{
    /// <summary>The display name of the project.</summary>
    string Name { get; }

    /// <summary>The organization that owns this project.</summary>
    IOrganization Organization { get; }

    /// <summary>Factory delegate for creating a new project.</summary>
    public delegate IProject CreateNew(string name, IOrganization organization);

    /// <summary>Factory delegate for reconstituting an existing project from persistence.</summary>
    public delegate IProject CreateExisting(string name, IOrganization organization, IDomainEntityData existing);
}
