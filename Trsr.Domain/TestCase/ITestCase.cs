using Trsr.Domain.Message;

namespace Trsr.Domain.TestCase;

public interface ITestCase : IDomainEntity, ITestCaseData
{
    public delegate ITestCase CreateNew(Conversation input, AssistantMessage expectedOutput);
    public delegate ITestCase CreateExisting(ITestCaseData existing);
}
