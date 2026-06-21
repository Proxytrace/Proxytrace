using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Security;
using Proxytrace.Common.Security;
using Proxytrace.Storage.Internal.Entities.ApiKey;
using Proxytrace.Storage.Internal.Entities.Invite;
using Proxytrace.Storage.Internal.Entities.ModelProvider;

namespace Proxytrace.Storage.Internal;

/// <summary>
/// One-time, idempotent in-place protection of pre-retrofit plaintext secrets. Runs after the
/// database initializer (migrations applied) and before the app serves traffic. Each table carries a
/// per-row marker so a partial run resumes and a re-run is a no-op:
/// <list type="bullet">
/// <item><description><c>ModelProvider</c>: <c>ApiKeyLookupHash IS NULL</c> ⇒ <c>ApiKey</c> still plaintext.</description></item>
/// <item><description><c>ApiKey</c>: <c>KeyPrefix IS NULL</c> ⇒ <c>KeyHash</c> still holds the plaintext key.</description></item>
/// <item><description><c>Invite</c>: a 64-char hash vs the 43-char base64url token ⇒ length 64 means done.</description></item>
/// </list>
/// It reads the still-plaintext value and writes the protected value directly (bypassing the
/// encrypt/hash-aware mappers). It never fails host boot: each table is isolated, and the provider
/// pass is skipped (logged) if encryption is unavailable, while the key-ring-independent hash passes
/// still run.
/// </summary>
internal sealed class SecretsBackfillService : IHostedService
{
    private const int InviteTokenHashLength = 64;
    private const int DisplayPrefixLength = 16;

    private readonly Func<StorageDbContext> contextFactory;
    private readonly ISecretProtector protector;
    private readonly ILogger<SecretsBackfillService> logger;

    public SecretsBackfillService(
        Func<StorageDbContext> contextFactory,
        ISecretProtector protector,
        ILogger<SecretsBackfillService> logger)
    {
        this.contextFactory = contextFactory;
        this.protector = protector;
        this.logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await RunSafely(BackfillProvidersAsync, "provider API key", cancellationToken);
        await RunSafely(BackfillApiKeysAsync, "inbound API key", cancellationToken);
        await RunSafely(BackfillInvitesAsync, "invite token", cancellationToken);
    }

    private async Task RunSafely(Func<CancellationToken, Task> pass, string what, CancellationToken cancellationToken)
    {
        try
        {
            await pass(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Secrets backfill for {What} failed; skipping (will retry next start).", what);
        }
    }

    private async Task BackfillProvidersAsync(CancellationToken cancellationToken)
    {
        var db = contextFactory();
        var rows = await db.Set<ModelProviderEntity>()
            .Where(e => e.ApiKeyLookupHash == null)
            .ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            db.Entry(row).CurrentValues.SetValues(row with
            {
                ApiKey = protector.Protect(row.ApiKey),
                ApiKeyLookupHash = Sha256.HexHash(row.ApiKey),
            });
        }

        if (rows.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Encrypted {Count} pre-existing provider API keys at rest.", rows.Count);
        }
    }

    private async Task BackfillApiKeysAsync(CancellationToken cancellationToken)
    {
        var db = contextFactory();
        var rows = await db.Set<ApiKeyEntity>()
            .Where(e => e.KeyPrefix == null)
            .ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            var plaintext = row.KeyHash;
            db.Entry(row).CurrentValues.SetValues(row with
            {
                KeyHash = Sha256.HexHash(plaintext),
                KeyPrefix = plaintext.Length <= DisplayPrefixLength ? plaintext : plaintext[..DisplayPrefixLength],
            });
        }

        if (rows.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Hashed {Count} pre-existing inbound API keys at rest.", rows.Count);
        }
    }

    private async Task BackfillInvitesAsync(CancellationToken cancellationToken)
    {
        var db = contextFactory();
        var rows = await db.Set<InviteEntity>()
            .Where(e => e.TokenHash.Length != InviteTokenHashLength)
            .ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            db.Entry(row).CurrentValues.SetValues(row with { TokenHash = Sha256.HexHash(row.TokenHash) });
        }

        if (rows.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Hashed {Count} pre-existing invite tokens at rest.", rows.Count);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
