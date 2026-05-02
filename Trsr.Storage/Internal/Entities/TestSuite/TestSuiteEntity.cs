using Trsr.Domain.TestSuite;

namespace Trsr.Storage.Internal.Entities.TestSuite;

[StoredDomainEntity(typeof(ITestSuite))]
internal record TestSuiteEntity : Entity
{
    /// <summary>
    /// <see cref="ITestSuite.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="ITestSuite.Agent"/>
    /// </summary>
    public required Guid Agent { get; init; }

    /// <summary>
    /// <see cref="ITestSuite.Evaluators"/>
    /// </summary>
    public required Guid Evaluator { get; init; }

    /// <summary>
    /// <see cref="ITestSuite.TestCases"/> - stored as JSON in the database
    /// </summary>
    public required IReadOnlyCollection<Guid> TestCases { get; init; }
}
