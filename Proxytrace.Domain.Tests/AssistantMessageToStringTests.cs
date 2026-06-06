using AwesomeAssertions;
using Proxytrace.Domain.Message;

namespace Proxytrace.Domain.Tests;

/// <summary>
/// ToString feeds the agentic evaluator's prompt verbatim. A tool-call-only assistant message
/// must not stringify to an empty body, or the judge reports "the response is empty".
/// </summary>
[TestClass]
public sealed class AssistantMessageToStringTests
{
    [TestMethod]
    public void ToString_WithToolRequestAndNoText_RendersToolCallNameAndArguments()
    {
        var message = new AssistantMessage(
            [],
            [new ToolRequest("call-1", "forecast_trend", """{"metric":"revenue","horizon_days":90}""")]);

        var text = message.ToString();

        text.Should().NotBeNullOrWhiteSpace();
        text.Should().Contain("forecast_trend");
        text.Should().Contain("revenue");
        text.Should().Contain("horizon_days");
    }

    [TestMethod]
    public void ToString_WithTextAndToolRequest_RendersBoth()
    {
        var message = new AssistantMessage(
            [Content.FromText("Let me forecast that.")],
            [new ToolRequest("call-1", "forecast_trend", "{}")]);

        var text = message.ToString();

        text.Should().Contain("Let me forecast that.");
        text.Should().Contain("forecast_trend");
    }

    [TestMethod]
    public void ToString_WithoutToolRequests_IsUnchanged()
    {
        var message = new AssistantMessage([Content.FromText("plain answer")], []);

        message.ToString().Should().Be("Assistant: plain answer");
    }

    [TestMethod]
    public void ToString_ToolMessage_RendersPayloadWithIdInlineNotOnItsOwnLine()
    {
        var message = new ToolMessage([Content.FromText("call-1"), Content.FromText("forecast complete")]);

        message.ToString().Should().Be("Tool (id: call-1): forecast complete");
    }
}
