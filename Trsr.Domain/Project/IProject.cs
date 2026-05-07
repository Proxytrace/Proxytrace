namespace Trsr.Domain.Project;

/// <summary>
/// Represents a project that owns agents and test suites.
/// </summary>
public interface IProject : IDomainEntity
{
    /// <summary>The display name of the project.</summary>
    string Name { get; }

    /// <summary>Factory delegate for creating a new project.</summary>
    public delegate IProject CreateNew(string name);

    /// <summary>Factory delegate for reconstituting an existing project from persistence.</summary>
    public delegate IProject CreateExisting(string name, IDomainEntityData existing);
}
