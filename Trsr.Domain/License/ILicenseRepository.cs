namespace Trsr.Domain.License;

public interface ILicenseRepository : IRepository<ILicense>
{
    Task<ILicense?> FindByEmailHash(string emailHash, CancellationToken cancellationToken = default);
}
