namespace Proxytrace.Domain.User;

/// <summary>
/// Authorization role granted to an <see cref="IUser"/>.
/// </summary>
public enum UserRole
{
    /// <summary>Read-only access.</summary>
    Viewer,

    /// <summary>Standard read/write access.</summary>
    Member,

    /// <summary>Full access including user management.</summary>
    Admin,
}
