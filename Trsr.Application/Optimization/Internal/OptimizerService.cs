using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Application.Streaming;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal class OptimizerService : BackgroundService, IOptimizerService
{
    private readonly IOptimizer optimizer;
    private readonly ITestRunGroupRepository testRunGroupRepository;
    private readonly IProposalBroadcaster broadcaster;
    private readonly ILogger<OptimizerService> logger;

    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public OptimizerService(
        IOptimizer optimizer,
        ITestRunGroupRepository testRunGroupRepository,
        IProposalBroadcaster broadcaster,
        ILogger<OptimizerService> logger)
    {
        this.optimizer = optimizer;
        this.testRunGroupRepository = testRunGroupRepository;
        this.broadcaster = broadcaster;
        this.logger = logger;
    }

    public Task EnqueueAsync(ITestRunGroup testRunGroup, CancellationToken cancellationToken = default)
        => channel.Writer.WriteAsync(testRunGroup.Id, cancellationToken).AsTask();

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (var groupId in channel.Reader.ReadAllAsync(cancellationToken))
            {
                try
                {
                    var group = await testRunGroupRepository.FindAsync(groupId, cancellationToken);
                    if (group is null)
                    {
                        logger.LogWarning("Test run group {GroupId} not found — skipping optimization", groupId);
                        continue;
                    }

                    logger.LogInformation("Running optimization for test run group {GroupId}", groupId);
                    var proposals = await optimizer.DiscoverOptimizations(group, cancellationToken);

                    foreach (var proposal in proposals)
                        broadcaster.Publish(ProposalCreatedEvent.Create(proposal));

                    logger.LogInformation("Optimization for group {GroupId} produced {Count} proposal(s)", groupId, proposals.Count);
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // individual job cancelled — continue processing
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Optimization failed for test run group {GroupId}", groupId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }
}
