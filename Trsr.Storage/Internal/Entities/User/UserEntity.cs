using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

[StoredDomainEntity(typeof(Trsr.Domain.User.IUser))]
[Cacheable]
internal record UserEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.User.IUser.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.User.IUser.Email"/>
    /// </summary>
    public required string Email { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.User.IUser.ExternalSubject"/>
    /// </summary>
    public required string ExternalSubject { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.User.IUser.Role"/>
    /// </summary>
    public required UserRole Role { get; init; }
}
