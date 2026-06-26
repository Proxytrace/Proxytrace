namespace Proxytrace.Domain.MfaBackupCode;

public interface IMfaBackupCodeRepository : IRepository<IMfaBackupCode>
{
    /// <summary>All backup codes (used and unused) belonging to the user.</summary>
    Task<IReadOnlyList<IMfaBackupCode>> ListByUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>The user's backup code matching the given hash, or <see langword="null"/> if none.</summary>
    Task<IMfaBackupCode?> FindByCodeHashAsync(Guid userId, string codeHash, CancellationToken cancellationToken = default);
}
