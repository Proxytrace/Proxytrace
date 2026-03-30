namespace Trsr.Domain.TestSuite;

public interface ITestSuiteData : IDomainEntityData
{
    public Guid Agent { get; }
    public Guid Evaluator { get; }
    public IReadOnlyCollection<Guid> TestCases { get; }
}
