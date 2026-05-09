using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Cleanup.Internal;

internal class DataCleanupService : IDataCleanupService
{
    private readonly IRepository<IOptimizationProposal> proposals;
    private readonly IRepository<ITestResult> testResults;
    private readonly IRepository<ITestRun> testRuns;
    private readonly IRepository<ITestRunGroup> testRunGroups;
    private readonly IRepository<IAgentCall> agentCalls;
    private readonly ITransaction transaction;

    public DataCleanupService(
        IRepository<IOptimizationProposal> proposals,
        IRepository<ITestResult> testResults,
        IRepository<ITestRun> testRuns,
        IRepository<ITestRunGroup> testRunGroups,
        IRepository<IAgentCall> agentCalls,
        ITransaction transaction)
    {
        this.proposals = proposals;
        this.testResults = testResults;
        this.testRuns = testRuns;
        this.testRunGroups = testRunGroups;
        this.agentCalls = agentCalls;
        this.transaction = transaction;
    }

    public Task DeleteAllNonModelDataAsync(CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            await proposals.RemoveAllAsync(cancellationToken);
            await testRuns.RemoveAllAsync(cancellationToken);
            await testRunGroups.RemoveAllAsync(cancellationToken);
            await testResults.RemoveAllAsync(cancellationToken);
            await agentCalls.RemoveAllAsync(cancellationToken);
        });
}
