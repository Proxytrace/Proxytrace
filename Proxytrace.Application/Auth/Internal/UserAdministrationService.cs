using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Internal;

internal sealed class UserAdministrationService : IUserAdministrationService
{
    private readonly IUserRepository users;

    public UserAdministrationService(IUserRepository users)
    {
        this.users = users;
    }

    public async Task<IUser?> ChangeRoleAsync(
        Guid actingUserId,
        Guid targetUserId,
        UserRole newRole,
        CancellationToken cancellationToken = default)
    {
        var target = await users.FindAsync(targetUserId, cancellationToken);
        if (target is null)
            return null;

        if (target.Role == newRole)
            return target;

        if (targetUserId == actingUserId)
            throw new UserAdministrationException("You cannot change your own role.");

        var demotesFromAdmin = target.Role == UserRole.Admin && newRole != UserRole.Admin;
        if (demotesFromAdmin && await IsLastAdminAsync(cancellationToken))
            throw new UserAdministrationException("At least one Admin must remain.");

        return await target.ChangeRole(newRole, cancellationToken);
    }

    public async Task<bool> RemoveAsync(
        Guid actingUserId,
        Guid targetUserId,
        CancellationToken cancellationToken = default)
    {
        var target = await users.FindAsync(targetUserId, cancellationToken);
        if (target is null)
            return false;

        if (targetUserId == actingUserId)
            throw new UserAdministrationException("You cannot delete your own account.");

        if (target.Role == UserRole.Admin && await IsLastAdminAsync(cancellationToken))
            throw new UserAdministrationException("At least one Admin must remain.");

        return await users.RemoveAsync(targetUserId, cancellationToken);
    }

    private async Task<bool> IsLastAdminAsync(CancellationToken cancellationToken)
        => await users.CountByRoleAsync(UserRole.Admin, cancellationToken) <= 1;
}
