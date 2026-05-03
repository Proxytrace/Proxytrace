using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.License;

namespace Trsr.Storage.Internal.Entities.License;

[UsedImplicitly]
internal class LicenseRepository : AbstractRepository<ILicense, LicenseEntity>, ILicenseRepository
{
    public LicenseRepository(
        IMapper<ILicense, LicenseEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<ILicense?> FindByEmailHash(string emailHash, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<LicenseEntity>()
            .AsNoTracking()
            .Where(x => x.EmailHash == emailHash)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
