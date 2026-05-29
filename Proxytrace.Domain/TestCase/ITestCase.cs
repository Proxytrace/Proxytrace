using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Message;

namespace Proxytrace.Domain.TestCase;

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
    /// Returns a short, single-line label for this test case based on its first user message,
    /// truncated to <paramref name="maxLength"/> characters with an ellipsis when the original
    /// text exceeds <paramref name="maxLength"/> + 3 characters.
    /// Returns <c>"Test case"</c> when no user message is present.
    /// </summary>
    string GetSummary(int maxLength = 77);

    /// <summary>Factory delegate for creating a new test case.</summary>
    public delegate ITestCase CreateNewFromCall(IAgentCall agentCall);

    /// <summary>Factory delegate for creating a new test case.</summary>
    public delegate ITestCase CreateNew(Conversation input, AssistantMessage expectedOutput);

    /// <summary>Factory delegate for reconstituting an existing test case from persistence.</summary>
    public delegate ITestCase CreateExisting(
        Conversation input,
        AssistantMessage expectedOutput,
        IDomainEntityData existing);
}
