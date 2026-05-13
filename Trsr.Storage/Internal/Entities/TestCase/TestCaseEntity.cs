using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Storage.Internal.Entities.TestCase;

[StoredDomainEntity(typeof(ITestCase))]
internal record TestCaseEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.TestCase.ITestCase.Input"/> - stored as JSON in the database
    /// </summary>
    public required Conversation Input { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.TestCase.ITestCase.ExpectedOutput"/> - stored as JSON in the database
    /// </summary>
    public required AssistantMessage ExpectedOutput { get; init; }
}
