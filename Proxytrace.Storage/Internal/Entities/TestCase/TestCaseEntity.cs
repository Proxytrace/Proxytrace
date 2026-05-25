using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestCase;

namespace Proxytrace.Storage.Internal.Entities.TestCase;

[StoredDomainEntity(typeof(ITestCase))]
internal record TestCaseEntity : Entity
{
    /// <summary>
    /// <see cref="Proxytrace.Domain.TestCase.ITestCase.Input"/> - stored as JSON in the database
    /// </summary>
    public required Conversation Input { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.TestCase.ITestCase.ExpectedOutput"/> - stored as JSON in the database
    /// </summary>
    public required AssistantMessage ExpectedOutput { get; init; }
}
