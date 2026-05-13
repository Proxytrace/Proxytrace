using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

[StoredDomainEntity(typeof(IUser))]
[Cacheable]
internal record UserEntity : Entity
{
    public required string Email { get; init; }

    /// <summary><see cref="Trsr.Domain.User.IUser.ExternalSubject"/>. Null for local-auth users.</summary>
    public string? ExternalSubject { get; init; }

    /// <summary><see cref="Trsr.Domain.User.IUser.PasswordHash"/>. Null for OIDC users.</summary>
    public string? PasswordHash { get; init; }

    public required UserRole Role { get; init; }
}
