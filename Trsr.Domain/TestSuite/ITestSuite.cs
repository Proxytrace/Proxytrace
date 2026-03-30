namespace Trsr.Domain.TestSuite;

public interface ITestSuite : IDomainEntity, ITestSuiteData
{
    public delegate ITestSuite CreateNew(Guid agent, Guid evaluator, IReadOnlyCollection<Guid> testCases);
    public delegate ITestSuite CreateExisting(ITestSuiteData existing);
}
