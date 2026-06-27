using System.ComponentModel.DataAnnotations;
using AwesomeAssertions;
using Proxytrace.Domain.Message;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class ToolMessageTests
{
    [TestMethod]
    public void Validate_MultiResultToolMessage_HasNoFailures()
    {
        // The ToolMessage(ToolResponse) factory prepends the id slot to every result, so a
        // two-result response produces three content slots. This must still validate.
        var message = new ToolMessage(BuildMultiResultResponse());

        message.Contents.Should().HaveCount(3); // id slot + two result slots

        var failures = message
            .Validate(new ValidationContext(message))
            .Where(result => result != ValidationResult.Success)
            .ToList();

        failures.Should().BeEmpty();
    }

    [TestMethod]
    public void GetText_MultiResultToolMessage_ConcatenatesAllResults()
    {
        var message = new ToolMessage(BuildMultiResultResponse());

        message.GetText().Should().Be("first resultsecond result");
    }

    [TestMethod]
    public void GetText_MultiResultToolMessage_MatchesDeconstruct()
    {
        var message = new ToolMessage(BuildMultiResultResponse());

        var (id, contents) = message.Deconstruct();
        var fromDeconstruct = string.Concat(contents.Select(content => content.Text ?? ""));

        id.Should().Be("call-1");
        contents.Should().HaveCount(2);
        message.GetText().Should().Be(fromDeconstruct);
    }

    private static ToolResponse BuildMultiResultResponse()
        => new(
            id: "call-1",
            results: [Content.FromText("first result"), Content.FromText("second result")],
            success: true,
            error: null);
}
