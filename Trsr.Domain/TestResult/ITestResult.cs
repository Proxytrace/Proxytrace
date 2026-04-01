using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult;

public interface ITestResult : IDomainEntity
{
    ITestCase TestCase { get; }
    AssistantMessage ActualResponse { get; }
    Evaluation Evaluation { get; }

    public delegate ITestResult CreateNew(ITestCase testCase, AssistantMessage actualResponse, Evaluation evaluation);
    public delegate ITestResult CreateExisting(ITestCase testCase, AssistantMessage actualResponse, Evaluation evaluation, IDomainEntityData existing);
}
