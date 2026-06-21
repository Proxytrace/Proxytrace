using Autofac;
using AwesomeAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Notifications;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Domain.Notification;
using Proxytrace.Testing;
using EmailSettingsEntity = Proxytrace.Storage.Internal.Entities.EmailSettings.EmailSettingsEntity;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class EmailSettingsStoreTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAsync_WhenNothingSaved_ReturnsNull()
    {
        var (store, _) = Resolve();

        (await store.GetAsync(CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public async Task SaveThenGet_RoundTripsAllFields_WithDecryptedPassword()
    {
        var (store, services) = Resolve();
        var settings = Sample() with { Password = "smtp-secret" };

        await store.SaveAsync(settings, CancellationToken);
        var loaded = await store.GetAsync(CancellationToken);

        loaded.Should().Be(settings);

        // The password must be encrypted at rest: the raw stored column is ciphertext,
        // not the plaintext we handed in. Proves SaveAsync actually invoked the protector.
        var stored = await RawEntity(services);
        stored.Password.Should().NotBeNull();
        stored.Password.Should().NotBe("smtp-secret");
    }

    [TestMethod]
    public async Task Save_Twice_KeepsSingleRow_AndOverwrites()
    {
        var (store, services) = Resolve();
        await store.SaveAsync(Sample() with { SmtpHost = "a.example" }, CancellationToken);
        await store.SaveAsync(Sample() with { SmtpHost = "b.example" }, CancellationToken);

        var loaded = await store.GetAsync(CancellationToken);

        loaded.Should().NotBeNull();
        loaded.Should().Match<EmailSettings>(s => s.SmtpHost == "b.example");

        var rowCount = await services.GetRequiredService<Func<StorageDbContext>>()()
            .Set<EmailSettingsEntity>()
            .CountAsync(CancellationToken);
        rowCount.Should().Be(1);
    }

    private (IEmailSettingsStore Store, IServiceProvider Services) Resolve()
    {
        // ISecretProtector is supplied by the loaded Application.Module; the test only needs to
        // bridge in IDataProtectionProvider so the real DataProtectionSecretProtector can construct.
        IServiceProvider services = GetServices(builder =>
            builder.RegisterServiceCollection(s => s.AddDataProtection()));
        return (services.GetRequiredService<IEmailSettingsStore>(), services);
    }

    private async Task<EmailSettingsEntity> RawEntity(IServiceProvider services) =>
        await services.GetRequiredService<Func<StorageDbContext>>()()
            .Set<EmailSettingsEntity>()
            .AsNoTracking()
            .FirstAsync(CancellationToken);

    private static EmailSettings Sample() => new(
        Enabled: true,
        SmtpHost: "smtp.example",
        SmtpPort: 587,
        Security: SmtpSecurity.StartTls,
        Username: "user",
        Password: null,
        FromAddress: "alerts@example.com",
        FromName: "Proxytrace",
        AppBaseUrl: "https://proxytrace.example.com",
        MinSeverity: NotificationSeverity.Warning);
}
