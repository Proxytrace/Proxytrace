using AwesomeAssertions;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Demo;

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

    [TestMethod]
    public void Get_NonKiosk_InteractiveTrue()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = false }, new KioskEndpointOptions());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeFalse();
        ((bool)result.interactive).Should().BeTrue();
    }

    [TestMethod]
    public void Get_KioskWithEndpoint_InteractiveTrue()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = true }, ConfiguredEndpoint());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeTrue();
        ((bool)result.interactive).Should().BeTrue();
    }

    [TestMethod]
    public void Get_KioskWithoutEndpoint_InteractiveFalse()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = true }, new KioskEndpointOptions());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeTrue();
        ((bool)result.interactive).Should().BeFalse();
    }
}
