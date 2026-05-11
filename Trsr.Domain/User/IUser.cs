namespace Trsr.Domain.User;

/// <summary>
/// Represents a user within the system.
/// </summary>
public interface IUser : IDomainEntity<IUser>
{
    /// <summary>The display name of the user.</summary>
    string Name { get; }

    /// <summary>The user's email address (primary identifier from the IdP).</summary>
    string Email { get; }

    /// <summary>
    /// Stable subject identifier issued by the external OIDC provider.
    /// Composed as <c>{issuer}|{sub}</c> to remain unique across multiple IdPs.
    /// </summary>
    string ExternalSubject { get; }

    /// <summary>Authorization role granted to this user.</summary>
    UserRole Role { get; }

    /// <summary>Updates the user's <see cref="Role"/> and persists.</summary>
    Task<IUser> ChangeRole(UserRole role, CancellationToken cancellationToken = default);

    /// <summary>Factory delegate for creating a new user.</summary>
    public delegate IUser CreateNew(string name, string email, string externalSubject, UserRole role);

    /// <summary>Factory delegate for reconstituting an existing user from persistence.</summary>
    public delegate IUser CreateExisting(string name, string email, string externalSubject, UserRole role, IDomainEntityData existing);
}
