using JetBrains.Annotations;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.TestCase;

namespace Proxytrace.Storage.Internal.Entities.TestCase;

[UsedImplicitly]
internal class TestCaseRepository : AbstractRepository<ITestCase, TestCaseEntity>, ITestCaseRepository
{
    public TestCaseRepository(
        IMapper<ITestCase, TestCaseEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }
}
