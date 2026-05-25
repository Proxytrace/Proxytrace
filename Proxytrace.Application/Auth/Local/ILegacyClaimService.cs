namespace Proxytrace.Application.Auth.Local;

public interface ILegacyClaimService
{
    Task<bool> IsClaimAvailableAsync(CancellationToken cancellationToken = default);

    Task<LoginResult?> ClaimAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default);
}
