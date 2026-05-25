using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth;

public interface IJitUserProvisioner
{
    Task<IUser> EnsureProvisionedAsync(
        string externalSubject,
        string email, 
        CancellationToken cancellationToken = default);
}
