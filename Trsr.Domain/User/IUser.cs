namespace Trsr.Domain.User;

/// <summary>
/// Represents a user within the system.
/// </summary>
public interface IUser : IDomainEntity
{
    /// <summary>The display name of the user.</summary>
    string Name { get; }

    /// <summary>Factory delegate for creating a new user.</summary>
    public delegate IUser CreateNew(string name);

    /// <summary>Factory delegate for reconstituting an existing user from persistence.</summary>
    public delegate IUser CreateExisting(string name, IDomainEntityData existing);
}
