using Trsr.Domain.TestRun;

namespace Trsr.Api.Services;

internal interface ITestRunExecutor
{
    Task<ITestRun> ExecuteRunAsync(ITestRun testRun, CancellationToken cancellationToken = default);
}
