using Trsr.Domain.User;

namespace Trsr.Application.Auth;

public interface IJitUserProvisioner
{
    Task<IUser> EnsureProvisionedAsync(
        string externalSubject,
        string email, 
        CancellationToken cancellationToken = default);
}
