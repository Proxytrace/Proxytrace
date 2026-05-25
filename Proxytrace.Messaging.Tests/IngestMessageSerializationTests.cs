using System.Text.Json;
using AwesomeAssertions;

namespace Proxytrace.Messaging.Tests;

[TestClass]
public sealed class IngestMessageSerializationTests
{
    [TestMethod]
    public void IngestMessage_RoundTripsThroughJson()
    {
        var original = new IngestMessage(
            ProviderId: Guid.NewGuid(),
            ProjectId: Guid.NewGuid(),
            RequestBody: """{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}""",
            ResponseBody: """{"choices":[{"message":{"role":"assistant","content":"hello"}}]}""",
            DurationMs: 1234,
            HttpStatus: 200,
            SessionId: "session-123");

        var json = JsonSerializer.Serialize(original);
        var restored = JsonSerializer.Deserialize<IngestMessage>(json);

        restored.Should().Be(original);
    }

    [TestMethod]
    public void IngestMessage_RoundTripsWithNullOptionalFields()
    {
        var original = new IngestMessage(
            ProviderId: Guid.NewGuid(),
            ProjectId: Guid.NewGuid(),
            RequestBody: "{}",
            ResponseBody: null,
            DurationMs: 0,
            HttpStatus: 502,
            SessionId: null);

        var restored = JsonSerializer.Deserialize<IngestMessage>(JsonSerializer.Serialize(original));

        restored.Should().Be(original);
    }
}
