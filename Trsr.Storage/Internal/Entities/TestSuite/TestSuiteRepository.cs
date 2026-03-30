using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.TestSuite;

namespace Trsr.Storage.Internal.Entities.TestSuite;

[UsedImplicitly]
internal class TestSuiteRepository : AbstractRepository<ITestSuite, TestSuiteEntity>, ITestSuiteRepository
{
    public TestSuiteRepository(
        IMapper<ITestSuite, TestSuiteEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}
