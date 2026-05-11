namespace Trsr.Domain.User;

/// <summary>
/// Repository for <see cref="IUser"/> entities with lookup by name and external subject.
/// </summary>
public interface IUserRepository : IRepository<IUser>
{
    /// <summary>
    /// Returns the user with the given <paramref name="name"/>, or <see langword="null"/> if none exists.
    /// </summary>
    public Task<IUser?> FindByName(string name, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the user with the given <paramref name="externalSubject"/> claim, or <see langword="null"/> if none exists.
    /// </summary>
    public Task<IUser?> FindByExternalSubjectAsync(string externalSubject, CancellationToken cancellationToken = default);
}
