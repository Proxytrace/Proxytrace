using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Services.Internal;

/// <summary>
/// Seeds realistic demo data on first startup in Development mode so the UI is
/// immediately populated for manual testing.  Runs after <see cref="Trsr.Storage.Internal.DatabaseInitializationService"/>
/// because hosted services start in registration order.
/// </summary>
internal sealed class DemoDataSeeder : IHostedService
{
    private const int DemoAgentCalls = 25;
    private const int DemoAgents = 3;

    private readonly IServiceProvider serviceProvider;
    private readonly ILogger<DemoDataSeeder> logger;

    public DemoDataSeeder(IServiceProvider serviceProvider, ILogger<DemoDataSeeder> logger)
    {
        this.serviceProvider = serviceProvider;
        this.logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var sp = scope.ServiceProvider;

        // Skip if the database already has data
        var orgRepository = sp.GetRequiredService<IRepository<IOrganization>>();
        if (await orgRepository.CountAsync(cancellationToken) > 0)
        {
            logger.LogInformation("Demo seed skipped — database already contains data");
            return;
        }

        logger.LogInformation("Seeding demo data for development...");

        // Organization (brings in users via OrganizationGenerator)
        var orgGenerator = sp.GetRequiredService<IDomainEntityGenerator<IOrganization>>();
        await orgGenerator.CreateAsync(cancellationToken);

        // Projects (ProjectGenerator creates them linked to the org)
        var projectGenerator = sp.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var project1 = await projectGenerator.CreateAsync(cancellationToken);
        var project2 = await projectGenerator.CreateAsync(cancellationToken);
        logger.LogDebug("Created demo projects {P1} and {P2}", project1.Id, project2.Id);

        // Agents
        var agentGenerator = sp.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        for (var i = 0; i < DemoAgents; i++)
            await agentGenerator.CreateAsync(cancellationToken);

        // Test suites
        var testSuiteGenerator = sp.GetRequiredService<IDomainEntityGenerator<ITestSuite>>();
        await testSuiteGenerator.CreateAsync(cancellationToken);

        // Agent calls (the trace data shown in the Traces view)
        var callGenerator = sp.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        for (var i = 0; i < DemoAgentCalls; i++)
            await callGenerator.CreateAsync(cancellationToken);

        logger.LogInformation(
            "Demo data seeded: 1 org, 2 projects, {Agents} agents, 1 test suite, {Calls} agent calls",
            DemoAgents, DemoAgentCalls);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
