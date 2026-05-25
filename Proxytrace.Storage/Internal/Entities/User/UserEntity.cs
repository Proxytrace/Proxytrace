using Proxytrace.Domain.User;

namespace Proxytrace.Storage.Internal.Entities.User;

[StoredDomainEntity(typeof(IUser))]
[Cacheable]
internal record UserEntity : Entity
{
    public required string Email { get; init; }

    /// <summary><see cref="Proxytrace.Domain.User.IUser.ExternalSubject"/>. Null for local-auth users.</summary>
    public string? ExternalSubject { get; init; }

    /// <summary><see cref="Proxytrace.Domain.User.IUser.PasswordHash"/>. Null for OIDC users.</summary>
    public string? PasswordHash { get; init; }

    public required UserRole Role { get; init; }
}
