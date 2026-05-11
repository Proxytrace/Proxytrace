using Trsr.Application.Auth;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Auth;

internal sealed class CurrentUserAccessor : ICurrentUserAccessor
{
    internal const string UserIdItemKey = "Trsr.UserId";

    private readonly IHttpContextAccessor httpContextAccessor;
    private readonly IRepository<IUser> users;

    public CurrentUserAccessor(IHttpContextAccessor httpContextAccessor, IRepository<IUser> users)
    {
        this.httpContextAccessor = httpContextAccessor;
        this.users = users;
    }

    public async Task<IUser?> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        var ctx = httpContextAccessor.HttpContext;
        if (ctx is null)
        {
            return null;
        }

        if (ctx.Items[UserIdItemKey] is not Guid userId)
        {
            return null;
        }
        
        return await users.FindAsync(userId, cancellationToken);
    }
}
