using Trsr.Domain.Message;
using Trsr.Domain.TestResult;

namespace Trsr.Storage.Internal.Entities.TestResult;

[StoredDomainEntity(typeof(ITestResult))]
internal record TestResultEntity : Entity
{
    public required Guid TestCase { get; init; }
    public required AssistantMessage ActualResponse { get; init; }
    public required Evaluation Evaluation { get; init; }
    public required long DurationMs { get; init; }
}
