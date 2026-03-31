using Trsr.Domain.Message;

namespace Trsr.Domain.TestCase;

public interface ITestCase : IDomainEntity
{
    Conversation Input { get; }
    AssistantMessage ExpectedOutput { get; }

    public delegate ITestCase CreateNew(Conversation input, AssistantMessage expectedOutput);
    public delegate ITestCase CreateExisting(Conversation input, AssistantMessage expectedOutput, IDomainEntityData existing);
}
