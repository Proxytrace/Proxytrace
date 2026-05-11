namespace Trsr.Domain.User;

public interface IUserRepository : IRepository<IUser>
{
    Task<IUser?> FindByExternalSubjectAsync(string externalSubject, CancellationToken cancellationToken = default);
    Task<IUser?> FindByEmailAsync(string email, CancellationToken cancellationToken = default);
}
