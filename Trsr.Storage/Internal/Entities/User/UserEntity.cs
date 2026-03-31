namespace Trsr.Storage.Internal.Entities.User;

[StoredDomainEntity(typeof(Trsr.Domain.User.IUser))]
internal record UserEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.User.IUser.Name"/>
    /// </summary>
    public required string Name { get; init; }
}
