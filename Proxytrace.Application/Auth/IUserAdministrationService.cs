using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth;

/// <summary>
/// Enforces cross-user management invariants when an admin promotes/demotes or removes users:
/// the system must always retain at least one Admin, and an admin may not change their own role or
/// delete their own account (which would risk an irrecoverable lock-out). Endpoint-level
/// <c>[Authorize(Roles = Admin)]</c> still gates who may call these operations.
/// </summary>
public interface IUserAdministrationService
{
    /// <summary>
    /// Changes the target user's role. Returns <see langword="null"/> if no such user exists.
    /// Throws <see cref="UserAdministrationException"/> if the acting user targets their own account
    /// or the change would drop the last remaining Admin.
    /// </summary>
    Task<IUser?> ChangeRoleAsync(
        Guid actingUserId,
        Guid targetUserId,
        UserRole newRole,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the target user. Throws <see cref="UserAdministrationException"/> if the target is
    /// the acting user or the last remaining Admin. Returns <see langword="false"/> if no such
    /// user exists.
    /// </summary>
    Task<bool> RemoveAsync(
        Guid actingUserId,
        Guid targetUserId,
        CancellationToken cancellationToken = default);
}
