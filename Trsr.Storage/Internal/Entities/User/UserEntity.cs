using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

[StoredDomainEntity(typeof(IUser))]
internal record UserEntity : Entity, IUser
{
    /// <summary>
    /// <see cref="IUser.Name"/>
    /// </summary>
    public required string Name { get; init; }
}