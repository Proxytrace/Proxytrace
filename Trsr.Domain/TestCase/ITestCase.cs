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

    /// <summary>Factory delegate for creating a new test case.</summary>
    public delegate ITestCase CreateNew(
        Conversation input,
        AssistantMessage expectedOutput);

    /// <summary>Factory delegate for reconstituting an existing test case from persistence.</summary>
    public delegate ITestCase CreateExisting(
        Conversation input,
        AssistantMessage expectedOutput,
        IDomainEntityData existing);
}
