using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Services;

public interface ITestRunnerService
{
    Task<ITestRun> RunAsync(ITestSuite suite, CancellationToken cancellationToken = default);
}
