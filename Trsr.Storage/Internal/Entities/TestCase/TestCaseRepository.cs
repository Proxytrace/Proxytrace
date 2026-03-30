using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.TestCase;

namespace Trsr.Storage.Internal.Entities.TestCase;

[UsedImplicitly]
internal class TestCaseRepository : AbstractRepository<ITestCase, TestCaseEntity>, ITestCaseRepository
{
    public TestCaseRepository(
        IMapper<ITestCase, TestCaseEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}
