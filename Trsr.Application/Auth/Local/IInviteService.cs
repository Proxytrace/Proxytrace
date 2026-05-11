using Trsr.Domain.Invite;
using Trsr.Domain.User;

namespace Trsr.Application.Auth.Local;

public interface IInviteService
{
    Task<IInvite> CreateAsync(
        string email,
        UserRole role,
        IUser invitedBy,
        CancellationToken cancellationToken = default);
    
    Task<IInvite?> GetByTokenAsync(
        string token,
        CancellationToken cancellationToken = default);
    
    Task<IUser?> ConsumeAsync(
        string token, 
        string password, 
        CancellationToken cancellationToken = default);
}
