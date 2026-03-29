using Trsr.Domain;
using Trsr.Domain.AgentCall;

namespace Trsr.Storage.Internal.Entities.AgentCall;

internal class AgentCallRepository : AbstractRepository<IAgentCall, AgentCallEntity>
{
    public AgentCallRepository(
        IMapper<IAgentCall, AgentCallEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}
