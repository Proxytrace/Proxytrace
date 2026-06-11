namespace Proxytrace.Domain.User;

/// <summary>
/// Authorization role granted to an <see cref="IUser"/>.
/// </summary>
public enum UserRole
{
    // Numeric values are explicit and start at 1 (the former Viewer = 0 was removed) so existing
    // Member/Admin rows keep their stored integer value. A data migration remaps any leftover
    // Viewer (0) rows to Member.

    /// <summary>Standard read/write access.</summary>
    Member = 1,

    /// <summary>Full access including user management.</summary>
    Admin = 2,
}
