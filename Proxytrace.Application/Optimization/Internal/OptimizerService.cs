using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

internal class OptimizerService : BackgroundService, IOptimizerService
{
    private readonly IOptimizer optimizer;
    private readonly ITestRunGroupRepository testRunGroupRepository;
    private readonly ITheoryValidationService theoryValidationService;
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
        ITheoryValidationService theoryValidationService,
        ILogger<OptimizerService> logger)
    {
        this.optimizer = optimizer;
        this.testRunGroupRepository = testRunGroupRepository;
        this.theoryValidationService = theoryValidationService;
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

                    logger.LogInformation("Discovering optimization theories for test run group {GroupId}", groupId);
                    var theories = await optimizer.DiscoverTheories(group, cancellationToken);

                    var submitted = 0;
                    foreach (var theory in theories)
                    {
                        var result = await theoryValidationService.SubmitAsync(theory, cancellationToken);
                        if (result.Outcome == TheorySubmissionOutcome.Accepted)
                            submitted++;
                    }

                    logger.LogInformation(
                        "Group {GroupId} produced {Discovered} theory/theories, {Submitted} submitted for validation",
                        groupId, theories.Count, submitted);
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
