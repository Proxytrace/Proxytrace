using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult;

public interface ITestResultGenerator : IDomainEntityGenerator<ITestResult>
{
    Task<ITestResult> CreateAsync(ITestCase testCase, CancellationToken cancellationToken = default);
}