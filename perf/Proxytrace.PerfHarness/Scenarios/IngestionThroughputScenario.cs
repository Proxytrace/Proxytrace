using System.Diagnostics;
using System.Net;
using Autofac;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.PerfHarness.Bootstrap;
using Proxytrace.PerfHarness.Reporting;

namespace Proxytrace.PerfHarness.Scenarios;

/// <summary>
/// Measures sustained write-ingestion throughput against the already-populated table: many concurrent
/// workers each persist single agent-call rows through the real repository (one <c>SaveChanges</c> per
/// call — the exact per-envelope DB cost the ingestion worker pays). Each worker uses its own lifetime
/// scope, mirroring the worker's per-envelope context isolation. The CPU cost of parsing the OpenAI
/// payload is measured separately by the BenchmarkDotNet micro-benchmarks; this isolates the database
/// write path, which is what degrades as the table grows.
/// </summary>
internal static class IngestionThroughputScenario
{
    public static async Task<MetricResult> RunAsync(
        PerfContainer container,
        PerfBudgets budgets,
        long ingestCount,
        int concurrency,
        CancellationToken cancellationToken)
    {
        // Reuse the seeded graph + a small canned-payload pool; build it once.
        var graph = await container.InScopeAsync(async scope =>
        {
            var agentRepo = scope.Resolve<IRepository<IAgent>>();
            var endpointRepo = scope.Resolve<IRepository<IModelEndpoint>>();
            var conversationGenerator = scope.Resolve<IDomainObjectGenerator<Conversation>>();
            var completionGenerator = scope.Resolve<IDomainObjectGenerator<ICompletion>>();
            var modelParametersGenerator = scope.Resolve<IDomainObjectGenerator<IModelParameters>>();

            var agents = (await agentRepo.GetAllAsync(cancellationToken)).Where(a => !a.IsSystemAgent).ToList();
            var endpoints = (await endpointRepo.GetAllAsync(cancellationToken)).ToList();
            if (agents.Count == 0 || endpoints.Count == 0)
            {
                throw new InvalidOperationException("No seeded agents/endpoints found — run `seed` first.");
            }

            var conversations = new List<Conversation>();
            var completions = new List<ICompletion>();
            var modelParameters = new List<IModelParameters>();
            for (int i = 0; i < 5; i++)
            {
                conversations.Add(await conversationGenerator.CreateAsync(cancellationToken));
                completions.Add(await completionGenerator.CreateAsync(cancellationToken));
                modelParameters.Add(await modelParametersGenerator.CreateAsync(cancellationToken));
            }

            return new IngestGraph(agents, endpoints, conversations, completions, modelParameters);
        });

        long perWorker = Math.Max(1, ingestCount / concurrency);
        long planned = perWorker * concurrency;
        Console.WriteLine($"[ingestion] inserting {planned:N0} calls across {concurrency} workers…");

        var stopwatch = Stopwatch.StartNew();
        var workers = Enumerable.Range(0, concurrency).Select(workerIndex => Task.Run(async () =>
        {
            var rng = new Random(1000 + workerIndex);
            for (long i = 0; i < perWorker; i++)
            {
                await container.InScopeAsync(async scope =>
                {
                    var createNew = scope.Resolve<IAgentCall.CreateNew>();
                    var repository = scope.Resolve<IAgentCallRepository>();

                    var agent = graph.Agents[rng.Next(graph.Agents.Count)];
                    var endpoint = graph.Endpoints[rng.Next(graph.Endpoints.Count)];
                    var call = createNew(
                        agent: agent,
                        version: agent.CurrentVersion,
                        endpoint: endpoint,
                        request: graph.Conversations[rng.Next(graph.Conversations.Count)],
                        response: graph.Completions[rng.Next(graph.Completions.Count)],
                        httpStatus: HttpStatusCode.OK,
                        finishReason: "stop",
                        errorMessage: null,
                        modelParameters: graph.ModelParameters[rng.Next(graph.ModelParameters.Count)],
                        conversationId: null);

                    await repository.AddAsync(call, cancellationToken);
                });
            }
        }, cancellationToken));

        await Task.WhenAll(workers);
        stopwatch.Stop();

        double callsPerSec = planned / stopwatch.Elapsed.TotalSeconds;
        Console.WriteLine($"[ingestion] {planned:N0} calls in {stopwatch.Elapsed.TotalSeconds:N1}s = {callsPerSec:N0} calls/s");

        double? budget = budgets.Ingestion.CallsPerSecMin > 0 ? budgets.Ingestion.CallsPerSecMin : null;
        return new MetricResult("ingestion", "ingestThroughput", callsPerSec, budget, "calls/s", BudgetDirection.HigherIsBetter);
    }

    private sealed record IngestGraph(
        IReadOnlyList<IAgent> Agents,
        IReadOnlyList<IModelEndpoint> Endpoints,
        IReadOnlyList<Conversation> Conversations,
        IReadOnlyList<ICompletion> Completions,
        IReadOnlyList<IModelParameters> ModelParameters);
}
