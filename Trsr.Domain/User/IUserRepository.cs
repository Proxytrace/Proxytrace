namespace Trsr.Domain.User;

/// <summary>
/// Repository for <see cref="IUser"/> entities with name-based lookup.
/// </summary>
public interface IUserRepository : IRepository<IUser>
{
    /// <summary>
    /// Returns the user with the given <paramref name="name"/>, or <see langword="null"/> if none exists.
    /// </summary>
    public Task<IUser?> FindByName(string name, CancellationToken cancellationToken = default);
}