using AwesomeAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Testing;
using ModelProviderEntity = Proxytrace.Storage.Internal.Entities.ModelProvider.ModelProviderEntity;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class ModelProviderSecretTests : BaseTest<Module>
{
    [TestMethod]
    public async Task ApiKey_IsEncryptedAtRest_AndRoundTrips()
    {
        IServiceProvider services = GetServices();
        var providers = services.GetRequiredService<IModelProviderRepository>();
        var create = services.GetRequiredService<IModelProvider.CreateNew>();

        var saved = await providers.AddAsync(
            create("p", new Uri("https://api.example.com/v1"), "sk-secret-123", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        // The stored column holds ciphertext + a blind-index hash, never the plaintext.
        var context = services.GetRequiredService<Func<StorageDbContext>>()();
        var raw = await context.Set<ModelProviderEntity>().AsNoTracking().FirstAsync(e => e.Id == saved.Id, CancellationToken);
        raw.ApiKey.Should().NotBe("sk-secret-123");
        raw.ApiKeyLookupHash.Should().NotBeNullOrEmpty();

        // Loading decrypts back to the plaintext so it can be replayed upstream.
        var loaded = await providers.FindAsync(saved.Id, CancellationToken);
        loaded.Should().NotBeNull();
        loaded?.ApiKey.Should().Be("sk-secret-123");
    }

    [TestMethod]
    public async Task FindByApiKey_ResolvesByPlaintext_ViaBlindIndex()
    {
        IServiceProvider services = GetServices();
        var providers = services.GetRequiredService<IModelProviderRepository>();
        var create = services.GetRequiredService<IModelProvider.CreateNew>();

        var saved = await providers.AddAsync(
            create("p", new Uri("https://api.example.com/v1"), "sk-secret-456", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        var byKey = await providers.FindByApiKeyAsync("sk-secret-456", CancellationToken);
        byKey.Should().NotBeNull();
        byKey?.Id.Should().Be(saved.Id);
    }
}
