using AwesomeAssertions;
using Proxytrace.Domain.Message;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class MessageGetTextTests
{
    [TestMethod]
    public void GetText_UserMessage_ConcatenatesAllTextContents()
    {
        var message = new UserMessage([Content.FromText("Hello "), Content.FromText("world")]);

        message.GetText().Should().Be("Hello world");
    }

    [TestMethod]
    public void GetText_AssistantMessage_ConcatenatesAllTextContents()
    {
        var message = new AssistantMessage([Content.FromText("part 1 "), Content.FromText("part 2")], []);

        message.GetText().Should().Be("part 1 part 2");
    }

    [TestMethod]
    public void GetText_SystemMessage_ConcatenatesAllTextContents()
    {
        var message = new SystemMessage("system prompt");

        message.GetText().Should().Be("system prompt");
    }

    [TestMethod]
    public void GetText_ToolMessage_ReturnsPayloadAndSkipsLeadingId()
    {
        var message = new ToolMessage([Content.FromText("call-1"), Content.FromText("payload")]);

        message.GetText().Should().Be("payload");
    }

    [TestMethod]
    public void GetText_ToolMessageWithIdOnly_ReturnsEmpty()
    {
        var message = new ToolMessage([Content.FromText("call-1")]);

        message.GetText().Should().BeEmpty();
    }
}
