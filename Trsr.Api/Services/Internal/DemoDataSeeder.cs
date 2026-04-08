using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;

namespace Trsr.Api.Services.Internal;

/// <summary>
/// Seeds demo data when the backend starts in development mode and the database is empty.
/// Reuses existing domain generators so the data is realistic and consistent.
/// </summary>
internal sealed class DemoDataSeeder : IHostedService
{
    private const int DemoAgentCount = 3;
    private const int DemoAgentCallCount = 60;

    private readonly IServiceProvider serviceProvider;
    private readonly ILogger<DemoDataSeeder> logger;

    public DemoDataSeeder(IServiceProvider serviceProvider, ILogger<DemoDataSeeder> logger)
    {
        this.serviceProvider = serviceProvider;
        this.logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();

        var agentCallRepository = scope.ServiceProvider.GetRequiredService<IRepository<IAgentCall>>();
        var count = await agentCallRepository.CountAsync(cancellationToken);
        if (count > 0)
        {
            logger.LogInformation("Database already contains data — skipping demo data seeding");
            return;
        }

        logger.LogInformation("Database is empty — seeding {AgentCount} agents and {CallCount} agent calls for local development",
            DemoAgentCount, DemoAgentCallCount);

        var agentGenerator = scope.ServiceProvider.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var agentCallGenerator = scope.ServiceProvider.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();

        for (int i = 0; i < DemoAgentCount; i++)
        {
            await agentGenerator.CreateAsync(cancellationToken);
        }

        for (int i = 0; i < DemoAgentCallCount; i++)
        {
            await agentCallGenerator.CreateAsync(cancellationToken);
        }

        logger.LogInformation("Demo data seeding complete");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
