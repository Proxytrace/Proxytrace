using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.Agent;

namespace Trsr.Storage.Internal.Entities.Agent;

[UsedImplicitly]
internal class AgentRepository : AbstractRepository<IAgent, AgentEntity>
{
    public AgentRepository(
        IMapper<IAgent, AgentEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}
