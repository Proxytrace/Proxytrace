namespace Trsr.Domain.User;

/// <summary>
/// Represents a user within the system. Identified by <see cref="Email"/>.
/// </summary>
public interface IUser : IDomainEntity<IUser>
{
    /// <summary>The user's email address (primary identifier and display name).</summary>
    string Email { get; }

    /// <summary>
    /// Stable subject identifier issued by the external OIDC provider (<c>{issuer}|{sub}</c>).
    /// <see langword="null"/> for local-auth users.
    /// </summary>
    string? ExternalSubject { get; }

    /// <summary>
    /// ASP.NET <see cref="Microsoft.AspNetCore.Identity.PasswordHasher{TUser}"/> output.
    /// <see langword="null"/> for OIDC users.
    /// </summary>
    string? PasswordHash { get; }

    /// <summary>Authorization role granted to this user.</summary>
    UserRole Role { get; }

    /// <summary>Updates the user's <see cref="Role"/> and persists.</summary>
    Task<IUser> ChangeRole(UserRole role, CancellationToken cancellationToken = default);

    /// <summary>Updates the user's <see cref="PasswordHash"/> and persists.</summary>
    Task<IUser> ChangePasswordHash(string passwordHash, CancellationToken cancellationToken = default);

    public delegate IUser CreateNew(string email, string? externalSubject, string? passwordHash, UserRole role);
    public delegate IUser CreateExisting(string email, string? externalSubject, string? passwordHash, UserRole role, IDomainEntityData existing);
}
