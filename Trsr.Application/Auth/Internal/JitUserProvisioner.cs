using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Application.Auth.Internal;

internal class JitUserProvisioner : IJitUserProvisioner
{
    private readonly IUserRepository users;
    private readonly IUser.CreateNew createUser;
    private readonly ITransaction transaction;

    public JitUserProvisioner(
        IUserRepository users,
        IUser.CreateNew createUser,
        ITransaction transaction)
    {
        this.users = users;
        this.createUser = createUser;
        this.transaction = transaction;
    }

    public Task<IUser> EnsureProvisionedAsync(
        string externalSubject,
        string email,
        CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            var existing = await users.FindByExternalSubjectAsync(externalSubject, cancellationToken);
            if (existing is not null) return existing;

            var total = await users.CountAsync(cancellationToken);
            var role = total == 0 ? UserRole.Admin : UserRole.Viewer;
            var user = createUser(email, externalSubject, passwordHash: null, role);
            return await user.AddAsync(cancellationToken);
        });
}
