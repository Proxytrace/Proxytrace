using Trsr.Domain.User;

namespace Trsr.Domain.Organization;

/// <summary>
/// Represents an organization that groups users and owns projects.
/// </summary>
public interface IOrganization : IDomainEntity
{
    /// <summary>The display name of the organization.</summary>
    string Name { get; }

    /// <summary>The users that belong to this organization.</summary>
    IReadOnlyCollection<IUser> Users { get; }

    /// <summary>Factory delegate for creating a new organization.</summary>
    public delegate IOrganization CreateNew(string name, IReadOnlyCollection<IUser> users);

    /// <summary>Factory delegate for reconstituting an existing organization from persistence.</summary>
    public delegate IOrganization CreateExisting(string name, IReadOnlyCollection<IUser> users, IDomainEntityData existing);
}
