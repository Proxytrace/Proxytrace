namespace Trsr.Domain.User;

public interface IUser : IDomainEntity
{
    string Name { get; }

    public delegate IUser CreateNew(string name);
    public delegate IUser CreateExisting(string name, IDomainEntityData existing);
}
