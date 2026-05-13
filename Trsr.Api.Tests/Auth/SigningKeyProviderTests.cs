using AwesomeAssertions;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using Trsr.Api.Auth;

namespace Trsr.Api.Tests.Auth;

[TestClass]
public sealed class SigningKeyProviderTests
{
    [TestMethod]
    public void EnsureSigningKey_ConfiguredValue_IsReturnedAsIs()
    {
        var env = Substitute.For<IHostEnvironment>();
        env.ContentRootPath.Returns(Path.GetTempPath());

        var result = SigningKeyProvider.EnsureSigningKey(env, "preset-key-1234");

        result.Should().Be("preset-key-1234");
    }

    [TestMethod]
    public void EnsureSigningKey_NoConfig_GeneratesAndPersistsKey()
    {
        var dir = Path.Combine(Path.GetTempPath(), "trsr-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var env = Substitute.For<IHostEnvironment>();
            env.ContentRootPath.Returns(dir);

            var first = SigningKeyProvider.EnsureSigningKey(env, configured: null);

            first.Should().NotBeNullOrWhiteSpace();
            File.Exists(Path.Combine(dir, "appsettings.local.json")).Should().BeTrue();
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch { }
        }
    }

    [TestMethod]
    public void EnsureSigningKey_ExistingFileWithKey_ReusesIt()
    {
        var dir = Path.Combine(Path.GetTempPath(), "trsr-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var env = Substitute.For<IHostEnvironment>();
            env.ContentRootPath.Returns(dir);
            File.WriteAllText(
                Path.Combine(dir, "appsettings.local.json"),
                """{"Authentication":{"Local":{"SigningKey":"persisted-key-xyz"}}}""");

            var key = SigningKeyProvider.EnsureSigningKey(env, configured: null);

            key.Should().Be("persisted-key-xyz");
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch { }
        }
    }
}
