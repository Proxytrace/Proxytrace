using Trsr.Domain.Message;

namespace Trsr.Domain.TestCase;

public interface ITestCaseData : IDomainEntityData
{
    public Conversation Input { get; }
    public AssistantMessage ExpectedOutput { get; }
}
