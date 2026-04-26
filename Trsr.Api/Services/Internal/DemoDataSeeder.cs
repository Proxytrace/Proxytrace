using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Storage;

namespace Trsr.Api.Services.Internal;

/// <summary>
/// Seeds demo data when the backend starts in development mode and the database is empty.
/// Executes the SQL scripts embedded in the assembly, which contain realistic agent traces,
/// test suites, test runs, and optimization proposals for three demo agents.
/// </summary>
internal sealed class DemoDataSeeder : IHostedService
{
    private const string ResourcePrefix = "Trsr.Api.DemoData.";

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

        var dbInitializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
        await dbInitializer.EnsureDatabaseReadyAsync(cancellationToken);

        var agentCallRepository = scope.ServiceProvider.GetRequiredService<IRepository<IAgentCall>>();
        var count = await agentCallRepository.CountAsync(cancellationToken);
        if (count > 0)
        {
            logger.LogInformation("Database already contains data — skipping demo data seeding");
            return;
        }

        var scripts = LoadDemoScripts();
        logger.LogInformation("Database is empty — seeding demo data from {ScriptCount} SQL scripts", scripts.Length);

        foreach (var (name, sql) in scripts)
        {
            logger.LogDebug("Executing demo data script: {ScriptName}", name);
            await dbInitializer.ExecuteSqlScriptAsync(sql, cancellationToken);
        }

        logger.LogInformation("Demo data seeding complete");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static (string Name, string Sql)[] LoadDemoScripts()
    {
        var assembly = typeof(DemoDataSeeder).Assembly;
        return assembly
            .GetManifestResourceNames()
            .Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal))
            .OrderBy(n => n, StringComparer.Ordinal)
            .Select(resourceName =>
            {
                using var stream = assembly.GetManifestResourceStream(resourceName)
                    ?? throw new InvalidOperationException($"Failed to load embedded resource: {resourceName}");
                using var reader = new StreamReader(stream);
                return (Name: resourceName[ResourcePrefix.Length..], Sql: reader.ReadToEnd());
            })
            .ToArray();
    }
}
