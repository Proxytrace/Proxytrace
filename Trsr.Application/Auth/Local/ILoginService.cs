using Trsr.Domain.User;

namespace Trsr.Application.Auth.Local;

public interface ILoginService
{
    Task<LoginResult?> LoginAsync(string email, string password, CancellationToken cancellationToken = default);
}

public sealed record LoginResult(IUser User, string Token, DateTimeOffset ExpiresAt);
