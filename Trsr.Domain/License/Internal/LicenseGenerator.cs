using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.License.Internal;

internal class LicenseGenerator : DomainEntityGenerator<ILicense>
{
    private readonly ILicense.CreateNew factory;

    public LicenseGenerator(
        ILicense.CreateNew factory,
        IRepository<ILicense> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
    }

    public override Task<ILicense> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
                emailHash: LicenseHasher.Hash(random.String() + "@example.com"),
                tier: LicenseTier.Full,
                expiresAt: null)
            .ToTaskResult();
}
