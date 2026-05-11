using Trsr.Domain.User;

namespace Trsr.Application.Auth;

/// <summary>
/// Provisions an <see cref="IUser"/> on first sight of an external OIDC subject.
/// The first user ever provisioned receives <see cref="UserRole.Admin"/>;
/// subsequent users default to <see cref="UserRole.Viewer"/>.
/// </summary>
public interface IJitUserProvisioner
{
    Task<IUser> EnsureProvisionedAsync(
        string externalSubject,
        string email,
        string displayName,
        CancellationToken cancellationToken = default);
}
