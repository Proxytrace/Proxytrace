using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.License;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class LicenseValidationTests : BaseTest<Module>
{
    private static string ValidHash => LicenseHasher.Hash("user@example.com");

    [TestMethod]
    public void CreateNew_WithValidArgs_CreatesLicense()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var license = factory(ValidHash, LicenseTier.Full, null);

        license.Should().NotBeNull();
        license.EmailHash.Should().Be(ValidHash);
        license.Tier.Should().Be(LicenseTier.Full);
        license.ExpiresAt.Should().BeNull();
        license.Id.Should().NotBe(Guid.Empty);
    }

    [TestMethod]
    public void CreateNew_WithAllTiers_Succeeds()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        factory(ValidHash, LicenseTier.Free, null).Tier.Should().Be(LicenseTier.Free);
        factory(LicenseHasher.Hash("demo@example.com"), LicenseTier.Demo, null).Tier.Should().Be(LicenseTier.Demo);
        factory(LicenseHasher.Hash("full@example.com"), LicenseTier.Full, null).Tier.Should().Be(LicenseTier.Full);
    }

    [TestMethod]
    public void CreateNew_WithExpiresAt_StoresValue()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();
        var expiry = DateTimeOffset.UtcNow.AddYears(1);

        var license = factory(ValidHash, LicenseTier.Full, expiry);

        license.ExpiresAt.Should().BeCloseTo(expiry, TimeSpan.FromSeconds(1));
    }

    [TestMethod]
    public void CreateNew_WithNullEmailHash_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, LicenseTier.Full, null);

        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyEmailHash_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var action = () => factory(string.Empty, LicenseTier.Full, null);

        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceEmailHash_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var action = () => factory("   ", LicenseTier.Full, null);

        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithUndefinedTier_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var action = () => factory(ValidHash, (LicenseTier)999, null);

        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void IsExpired_WhenExpiresAtIsNull_ReturnsFalse()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var license = factory(ValidHash, LicenseTier.Full, null);

        license.IsExpired.Should().BeFalse();
    }

    [TestMethod]
    public void IsExpired_WhenExpiresAtIsInFuture_ReturnsFalse()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var license = factory(ValidHash, LicenseTier.Full, DateTimeOffset.UtcNow.AddDays(30));

        license.IsExpired.Should().BeFalse();
    }

    [TestMethod]
    public void IsExpired_WhenExpiresAtIsInPast_ReturnsTrue()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ILicense.CreateNew>();

        var license = factory(ValidHash, LicenseTier.Demo, DateTimeOffset.UtcNow.AddDays(-1));

        license.IsExpired.Should().BeTrue();
    }

    [TestMethod]
    public async Task CreateExisting_PreservesIdAndTimestamps()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<ILicense.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<ILicense>>();
        var existing = await generator.CreateAsync(CancellationToken);

        var restored = createExisting(existing.EmailHash, existing.Tier, existing.ExpiresAt, existing);

        restored.Id.Should().Be(existing.Id);
        restored.CreatedAt.Should().Be(existing.CreatedAt);
        restored.UpdatedAt.Should().Be(existing.UpdatedAt);
        restored.EmailHash.Should().Be(existing.EmailHash);
        restored.Tier.Should().Be(existing.Tier);
    }

    [TestMethod]
    public void LicenseHasher_NormalizesEmail()
    {
        var hash1 = LicenseHasher.Hash("User@Example.COM");
        var hash2 = LicenseHasher.Hash("user@example.com");
        var hash3 = LicenseHasher.Hash("  user@example.com  ");

        hash1.Should().Be(hash2);
        hash2.Should().Be(hash3);
    }

    [TestMethod]
    public void LicenseHasher_ProducesHexString()
    {
        var hash = LicenseHasher.Hash("user@example.com");

        hash.Should().HaveLength(64);
        hash.Should().MatchRegex("^[0-9a-f]+$");
    }
}
