using Microsoft.AspNetCore.Identity;
using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Local.Internal;

internal sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<IUser> hasher = new();

    public string Hash(IUser user, string password) 
        => hasher.HashPassword(user, password);

    public bool Verify(IUser user, string hash, string password)
    {
        var result = hasher.VerifyHashedPassword(user, hash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
