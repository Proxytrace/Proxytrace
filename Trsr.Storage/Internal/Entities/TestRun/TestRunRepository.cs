using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.TestRun;

namespace Trsr.Storage.Internal.Entities.TestRun;

[UsedImplicitly]
internal class TestRunRepository : AbstractRepository<ITestRun, TestRunEntity>, ITestRunRepository
{
    public TestRunRepository(
        IMapper<ITestRun, TestRunEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}
