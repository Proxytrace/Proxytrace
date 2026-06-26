namespace Proxytrace.Domain.PasswordResetToken;

public interface IPasswordResetTokenRepository : IRepository<IPasswordResetToken>
{
    Task<IPasswordResetToken?> FindByTokenAsync(string token, CancellationToken cancellationToken = default);
}
