using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Application.Security;
using Proxytrace.Common.Time;
using AppEmailSettings = Proxytrace.Application.Notifications.EmailSettings;
using IEmailSettingsStore = Proxytrace.Application.Notifications.IEmailSettingsStore;

namespace Proxytrace.Storage.Internal.Entities.EmailSettings;

[UsedImplicitly]
internal sealed class EmailSettingsStore : IEmailSettingsStore
{
    private readonly Func<StorageDbContext> contextFactory;
    private readonly ISecretProtector secretProtector;
    private readonly IClock clock;

    public EmailSettingsStore(
        Func<StorageDbContext> contextFactory,
        ISecretProtector secretProtector,
        IClock clock)
    {
        this.contextFactory = contextFactory;
        this.secretProtector = secretProtector;
        this.clock = clock;
    }

    public async Task<AppEmailSettings?> GetAsync(CancellationToken cancellationToken = default)
    {
        EmailSettingsEntity? entity = await contextFactory()
            .Set<EmailSettingsEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        if (entity is null)
            return null;

        var password = string.IsNullOrEmpty(entity.Password)
            ? null
            : secretProtector.Unprotect(entity.Password);

        return new AppEmailSettings(
            entity.Enabled,
            entity.SmtpHost,
            entity.SmtpPort,
            entity.Security,
            entity.Username,
            password,
            entity.FromAddress,
            entity.FromName,
            entity.AppBaseUrl,
            entity.MinSeverity);
    }

    public async Task SaveAsync(AppEmailSettings settings, CancellationToken cancellationToken = default)
    {
        var cipher = string.IsNullOrEmpty(settings.Password)
            ? null
            : secretProtector.Protect(settings.Password);

        StorageDbContext context = contextFactory();
        DbSet<EmailSettingsEntity> set = context.Set<EmailSettingsEntity>();
        var now = clock.UtcNow;

        EmailSettingsEntity? existing = await set.FirstOrDefaultAsync(cancellationToken);
        if (existing is null)
        {
            set.Add(new EmailSettingsEntity
            {
                Id = Guid.NewGuid(),
                Enabled = settings.Enabled,
                SmtpHost = settings.SmtpHost,
                SmtpPort = settings.SmtpPort,
                Security = settings.Security,
                Username = settings.Username,
                Password = cipher,
                FromAddress = settings.FromAddress,
                FromName = settings.FromName,
                AppBaseUrl = settings.AppBaseUrl,
                MinSeverity = settings.MinSeverity,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }
        else
        {
            context.Entry(existing).CurrentValues.SetValues(existing with
            {
                Enabled = settings.Enabled,
                SmtpHost = settings.SmtpHost,
                SmtpPort = settings.SmtpPort,
                Security = settings.Security,
                Username = settings.Username,
                Password = cipher,
                FromAddress = settings.FromAddress,
                FromName = settings.FromName,
                AppBaseUrl = settings.AppBaseUrl,
                MinSeverity = settings.MinSeverity,
                UpdatedAt = now,
            });
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
