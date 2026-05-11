using Trsr.Domain.User;

namespace Trsr.Application.Auth.Local;

public interface IPasswordService
{
    string Hash(IUser user, string password);
    bool Verify(IUser user, string hash, string password);
}
