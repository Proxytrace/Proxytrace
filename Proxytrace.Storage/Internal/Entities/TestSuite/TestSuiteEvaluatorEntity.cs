namespace Proxytrace.Storage.Internal.Entities.TestSuite;

/// <summary>
/// Join table entity for the many-to-many relationship between TestSuites and Evaluators.
/// This is a storage-only entity with no domain counterpart.
/// </summary>
internal record TestSuiteEvaluatorEntity
{
    public required Guid TestSuiteId { get; init; }
    public required Guid EvaluatorId { get; init; }
}
