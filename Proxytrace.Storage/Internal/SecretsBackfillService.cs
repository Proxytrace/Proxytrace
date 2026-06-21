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

    private const int MaxAttempts = 3;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(2);

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Until a row is backfilled its lookup column still holds the pre-retrofit plaintext, so the
        // hashed/encrypted lookup cannot match it — the impact text below spells out what stops
        // working if a pass keeps failing.
        await RunSafely(BackfillProvidersAsync, "provider API key",
            "existing providers cannot authenticate upstream until this completes", cancellationToken);
        await RunSafely(BackfillApiKeysAsync, "inbound API key",
            "existing API keys cannot authenticate at the proxy or MCP server until this completes", cancellationToken);
        await RunSafely(BackfillInvitesAsync, "invite token",
            "pending invites cannot be redeemed until this completes", cancellationToken);
    }

    /// <summary>
    /// Runs a single table's backfill with a few retries for transient faults. On persistent failure
    /// it logs at Critical (surfaced in the operator Error Log) with the operational impact, rather
    /// than failing host boot — but the impact is real, so the message is loud and actionable: a
    /// restart re-runs the backfill, and the affected credentials stay broken until it succeeds.
    /// </summary>
    private async Task RunSafely(Func<CancellationToken, Task> pass, string what, string impact, CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                await pass(cancellationToken);
                return;
            }
            catch (Exception ex) when (attempt < MaxAttempts && !cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Secrets backfill for {What} failed (attempt {Attempt}/{Max}); retrying.",
                    what, attempt, MaxAttempts);
                await Task.Delay(RetryDelay, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogCritical(ex,
                    "Secrets backfill for {What} failed after {Max} attempts — {Impact}. Restart to retry.",
                    what, MaxAttempts, impact);
                return;
            }
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
