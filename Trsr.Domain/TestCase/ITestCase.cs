using Trsr.Domain.Message;

namespace Trsr.Domain.TestCase;

/// <summary>
/// Represents a single test case consisting of an input conversation and the expected assistant response.
/// </summary>
public interface ITestCase : IDomainEntity
{
    /// <summary>The conversation sent to the agent as input.</summary>
    Conversation Input { get; }

    /// <summary>The expected assistant response used for evaluation.</summary>
    AssistantMessage ExpectedOutput { get; }

    /// <summary>
    /// The ID of the <see cref="AgentCall.IAgentCall"/> this test case was promoted from, or
    /// <see langword="null"/> if the test case was created manually.
    /// </summary>
    Guid? SourceAgentCallId { get; }

    /// <summary>Factory delegate for creating a new test case.</summary>
    public delegate ITestCase CreateNew(
        Conversation input,
        AssistantMessage expectedOutput,
        Guid? sourceAgentCallId = null);

    /// <summary>Factory delegate for reconstituting an existing test case from persistence.</summary>
    public delegate ITestCase CreateExisting(
        Conversation input,
        AssistantMessage expectedOutput,
        IDomainEntityData existing,
        Guid? sourceAgentCallId = null);
}
