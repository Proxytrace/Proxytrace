namespace Trsr.Domain.Organization;

/// <summary>
/// Repository for <see cref="IOrganization"/> entities with name-based lookup.
/// </summary>
public interface IOrganizationRepository : IRepository<IOrganization>
{
    /// <summary>
    /// Returns the organization with the given <paramref name="name"/>, or <see langword="null"/> if none exists.
    /// </summary>
    Task<IOrganization?> FindByNameAsync(string name, CancellationToken cancellationToken = default);
}
