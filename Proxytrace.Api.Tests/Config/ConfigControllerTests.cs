using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Demo;
using Proxytrace.Common.Hosting;

namespace Proxytrace.Api.Tests.Config;

[TestClass]
public sealed class ConfigControllerTests
{
    private static KioskEndpointOptions ConfiguredEndpoint() => new()
    {
        BaseUrl = "https://api.openai.com/v1",
        ApiKey = "sk-test",
        Model = "gpt-4o",
    };

    private static IAppVersion AppVersion(string version = "1.2.3")
    {
        var appVersion = Substitute.For<IAppVersion>();
        appVersion.Version.Returns(version);
        return appVersion;
    }

    [TestMethod]
    public void Get_NonKiosk_InteractiveTrue()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = false }, new KioskEndpointOptions(), AppVersion());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeFalse();
        ((bool)result.interactive).Should().BeTrue();
    }

    [TestMethod]
    public void Get_KioskWithEndpoint_InteractiveTrue()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = true }, ConfiguredEndpoint(), AppVersion());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeTrue();
        ((bool)result.interactive).Should().BeTrue();
    }

    [TestMethod]
    public void Get_KioskWithoutEndpoint_InteractiveFalse()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = true }, new KioskEndpointOptions(), AppVersion());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeTrue();
        ((bool)result.interactive).Should().BeFalse();
    }

    [TestMethod]
    public void Get_ReturnsAppVersion()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = false }, new KioskEndpointOptions(), AppVersion("4.5.6"));

        dynamic result = controller.Get();

        ((string)result.version).Should().Be("4.5.6");
    }
}
