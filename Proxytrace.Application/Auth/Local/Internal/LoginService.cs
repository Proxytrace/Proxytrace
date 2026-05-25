using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Local.Internal;

internal sealed class LoginService : ILoginService
{
    private readonly IUserRepository users;
    private readonly IPasswordService passwords;
    private readonly ILocalTokenIssuer tokens;

    public LoginService(IUserRepository users, IPasswordService passwords, ILocalTokenIssuer tokens)
    {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
    }

    public async Task<LoginResult?> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByEmailAsync(email, cancellationToken);
        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
        {
            return null;
        }

        if (!passwords.Verify(user, user.PasswordHash, password))
        {
            return null;
        }
        
        var issued = tokens.Issue(user);
        return new LoginResult(user, issued.Token, issued.ExpiresAt);
    }
}
