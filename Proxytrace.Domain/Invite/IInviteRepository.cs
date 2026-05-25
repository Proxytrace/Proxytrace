namespace Proxytrace.Domain.Invite;

public interface IInviteRepository : IRepository<IInvite>
{
    Task<IInvite?> FindByTokenAsync(string token, CancellationToken cancellationToken = default);
}
