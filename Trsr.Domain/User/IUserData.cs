namespace Trsr.Domain.User;

public interface IUserData : IDomainEntityData
{
    public string Name { get; }
}