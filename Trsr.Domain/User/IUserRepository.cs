namespace Trsr.Domain.User;

public interface IUserRepository : IRepository<IUser>
{
    public Task<IUser?> FindByName(string name, CancellationToken cancellationToken = default);
}