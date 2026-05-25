using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.Hosting;
using Microsoft.Testing.Platform.Services;
using NSubstitute;
using Proxytrace.Api.Auth;
using Proxytrace.Common.Lifecycle;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests.Auth;

[TestClass]
public sealed class SigningKeyProviderTests : BaseTest<Module>
{
    [TestMethod]
    public void EnsureSigningKey_ConfiguredValue_IsReturnedAsIs()
    {
        var services = GetServices();
        var provider = services.GetRequiredService<ISigningKeyProvider>();
        var result = provider.EnsureSigningKey("preset-key-1234");

        result.Should().Be("preset-key-1234");
    }

    [TestMethod]
    public void EnsureSigningKey_NoConfig_GeneratesAndPersistsKey()
    {
        var services = GetServices();
        var host = services.GetRequiredService<IHostEnvironment>();
        var dir = host.ContentRootPath;
        try
        {
            var env = Substitute.For<IHostEnvironment>();
            env.ContentRootPath.Returns(dir);

            var provider = services.GetRequiredService<ISigningKeyProvider>();
            var first = provider.EnsureSigningKey(configured: null);

            first.Should().NotBeNullOrWhiteSpace();
            File.Exists(Path.Combine(dir, "appsettings.local.json")).Should().BeTrue();
        }
        finally
        {
            try
            {
                Directory.Delete(dir, recursive: true);
            }
            catch
            {
                // ignored
            }
        }
    }

    [TestMethod]
    public void EnsureSigningKey_ExistingFileWithKey_ReusesIt()
    {
        var services = GetServices();
        var env = services.GetRequiredService<IHostEnvironment>();
        var dir = env.ContentRootPath;
        try
        {
            File.WriteAllText(
                Path.Combine(dir, "appsettings.local.json"),
                """{"Authentication":{"Local":{"SigningKey":"persisted-key-xyz"}}}""");

            var provider = services.GetRequiredService<ISigningKeyProvider>();
            var key = provider.EnsureSigningKey(configured: null);

            key.Should().Be("persisted-key-xyz");
        }
        finally
        {
            try
            {
                Directory.Delete(dir, recursive: true);
            }
            catch
            {
                // ignored
            }
        }
    }
}