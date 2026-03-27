namespace Trsr.Domain.User;

public interface IUser : IDomainEntity, IUserData
{
    public delegate IUser CreateNew(string name);
    public delegate IUser CreateExisting(IUserData existing);
}