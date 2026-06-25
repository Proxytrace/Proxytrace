using AwesomeAssertions;
using Proxytrace.Domain.Message;

namespace Proxytrace.Domain.Tests;

/// <summary>
/// GetDisplayText feeds the evaluator playground's reference / candidate panes. A tool-call-only
/// assistant turn must render the tool call, not an empty string — otherwise the panes show
/// "—" / blank (issue #234). Unlike <see cref="AssistantMessage.ToString"/> it omits the role prefix.
/// </summary>
[TestClass]
public sealed class AssistantMessageGetDisplayTextTests
{
    [TestMethod]
    public void GetDisplayText_WithToolRequestAndNoText_RendersToolCallNameAndArguments()
    {
        var message = new AssistantMessage(
            [],
            [new ToolRequest("call-1", "forecast_trend", """{"metric":"revenue","horizon_days":90}""")]);

        var text = message.GetDisplayText();

        text.Should().NotBeNullOrWhiteSpace();
        text.Should().Contain("[tool call]");
        text.Should().Contain("forecast_trend");
        text.Should().Contain("revenue");
        text.Should().Contain("horizon_days");
    }

    [TestMethod]
    public void GetDisplayText_WithTextAndToolRequest_RendersBoth()
    {
        var message = new AssistantMessage(
            [Content.FromText("Let me forecast that.")],
            [new ToolRequest("call-1", "forecast_trend", "{}")]);

        var text = message.GetDisplayText();

        text.Should().Contain("Let me forecast that.");
        text.Should().Contain("[tool call]");
        text.Should().Contain("forecast_trend");
    }

    [TestMethod]
    public void GetDisplayText_WithoutToolRequests_ReturnsPlainText()
    {
        var message = new AssistantMessage([Content.FromText("plain answer")], []);

        message.GetDisplayText().Should().Be("plain answer");
    }

    [TestMethod]
    public void GetDisplayText_WithNoContentAndNoToolRequests_ReturnsEmpty()
    {
        var message = new AssistantMessage([], []);

        message.GetDisplayText().Should().BeEmpty();
    }
}
