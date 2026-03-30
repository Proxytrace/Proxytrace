namespace Trsr.Domain.TestSuite;

public interface ITestSuite : IDomainEntity, ITestSuiteData
{
    public delegate ITestSuite CreateNew(Guid agent, IReadOnlyCollection<Guid> testCases);
    public delegate ITestSuite CreateExisting(ITestSuiteData existing);
}
