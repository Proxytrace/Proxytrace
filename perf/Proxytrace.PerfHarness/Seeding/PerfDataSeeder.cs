using System.Diagnostics;
using System.Net;
using Autofac;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Usage;
using Proxytrace.PerfHarness.Bootstrap;

namespace Proxytrace.PerfHarness.Seeding;

/// <summary>
/// Bulk-loads a realistic dataset into the perf Postgres database. A small fixed graph (one project,
/// a handful of endpoints, dozens of agents) is created through the production generators, then the
/// high-volume <see cref="IAgentCall"/> rows are built via the <see cref="IAgentCall.CreateExisting"/>
/// factory — which lets us stamp a controlled <c>CreatedAt</c> (the mapper copies it verbatim) so the
/// rows spread across a realistic time window — and inserted in batches through the real repository.
/// </summary>
internal sealed class PerfDataSeeder
{
    private readonly PerfContainer container;

    public PerfDataSeeder(PerfContainer container)
    {
        this.container = container;
    }

    public async Task<SeedSummary> SeedAsync(SeedOptions options, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var rng = new Random(options.RandomSeed);

        // --- 1. fixed seed graph + canned payload pools (one scope) ---
        Console.WriteLine($"[seed] building fixed graph: 1 project, {options.EndpointCount} endpoints, {options.AgentCount} agents…");
        var graph = await BuildGraphAsync(options, cancellationToken);

        // --- 2. high-volume agent-call rows, batched ---
        var start = DateTimeOffset.UtcNow.AddDays(-options.DaysSpread);
        var span = TimeSpan.FromDays(options.DaysSpread);

        // Pool of conversation ids so ~ConversationRate of calls cluster into multi-turn threads.
        int conversationPoolSize = Math.Max(1, (int)(options.TargetCalls * options.ConversationRate / 3));
        var conversationIds = Enumerable.Range(0, conversationPoolSize).Select(_ => Guid.NewGuid()).ToArray();

        long inserted = 0;
        while (inserted < options.TargetCalls)
        {
            int batchCount = (int)Math.Min(options.BatchSize, options.TargetCalls - inserted);

            await container.InScopeAsync(async scope =>
            {
                var createExisting = scope.Resolve<IAgentCall.CreateExisting>();
                var createCompletion = scope.Resolve<ICompletion.Create>();
                var repository = scope.Resolve<IAgentCallRepository>();

                var batch = new List<IAgentCall>(batchCount);
                for (int i = 0; i < batchCount; i++)
                {
                    batch.Add(BuildCall(graph, conversationIds, createExisting, createCompletion, rng, start, span, options));
                }

                await repository.AddRangeAsync(batch, cancellationToken);
            });

            inserted += batchCount;
            Console.WriteLine($"[seed] {inserted:N0}/{options.TargetCalls:N0} calls ({stopwatch.Elapsed:hh\\:mm\\:ss})");
        }

        stopwatch.Stop();
        Console.WriteLine($"[seed] done: {inserted:N0} calls in {stopwatch.Elapsed:hh\\:mm\\:ss}");

        return new SeedSummary(
            ProjectId: graph.ProjectId,
            ProviderId: graph.ProviderId,
            AgentIds: graph.Agents.Select(a => a.Id).ToArray(),
            EndpointIds: graph.Endpoints.Select(e => e.Id).ToArray(),
            CallsInserted: inserted,
            Elapsed: stopwatch.Elapsed);
    }

    private async Task<SeedGraph> BuildGraphAsync(SeedOptions options, CancellationToken cancellationToken)
    {
        return await container.InScopeAsync(async scope =>
        {
            var projectGenerator = scope.Resolve<IDomainEntityGenerator<IProject>>();
            var providerGenerator = scope.Resolve<IDomainEntityGenerator<IModelProvider>>();
            var modelGenerator = scope.Resolve<IDomainEntityGenerator<IModel>>();
            var endpointFactory = scope.Resolve<IModelEndpoint.CreateNew>();
            var endpointRepository = scope.Resolve<IRepository<IModelEndpoint>>();
            var agentGenerator = scope.Resolve<IAgentGenerator>();
            var conversationGenerator = scope.Resolve<IDomainObjectGenerator<Conversation>>();
            var completionGenerator = scope.Resolve<IDomainObjectGenerator<ICompletion>>();
            var modelParametersGenerator = scope.Resolve<IDomainObjectGenerator<IModelParameters>>();

            var project = await projectGenerator.GetOrCreateAsync(cancellationToken);

            // One shared provider with N distinct models — ModelEndpoint is unique per (model, provider),
            // so each endpoint needs its own model rather than reusing the generator's GetOrCreate pair.
            var provider = await providerGenerator.CreateAsync(cancellationToken);
            var endpoints = new List<IModelEndpoint>(options.EndpointCount);
            for (int i = 0; i < options.EndpointCount; i++)
            {
                var model = await modelGenerator.CreateAsync(cancellationToken);
                var endpoint = endpointFactory(model, provider, 0.000001m, 0.000003m, 0.0000005m);
                endpoints.Add(await endpointRepository.AddAsync(endpoint, cancellationToken));
            }

            // A distinct system prompt per agent keeps each initial version's fingerprint unique
            // (AgentVersion is unique per (Project, Fingerprint), which a shared generated prompt breaks).
            var agents = new List<IAgent>(options.AgentCount);
            for (int i = 0; i < options.AgentCount; i++)
            {
                agents.Add(await agentGenerator.CreateAsync(
                    $"Perf Agent {i:D3}",
                    systemPrompt: $"You are perf test agent number {i}. Answer concisely.",
                    cancellationToken: cancellationToken));
            }

            // Canned payload pools reused across all rows. Token usage and latency are varied per row
            // at build time; the conversation/assistant-message shapes come from a small fixed pool.
            var conversations = new List<Conversation>();
            for (int i = 0; i < 10; i++)
            {
                conversations.Add(await conversationGenerator.CreateAsync(cancellationToken));
            }

            var assistantMessages = new List<AssistantMessage>();
            for (int i = 0; i < 5; i++)
            {
                assistantMessages.Add((await completionGenerator.CreateAsync(cancellationToken)).Response);
            }

            var modelParameters = new List<IModelParameters>();
            for (int i = 0; i < 5; i++)
            {
                modelParameters.Add(await modelParametersGenerator.CreateAsync(cancellationToken));
            }

            return new SeedGraph(project.Id, provider.Id, agents, endpoints, conversations, assistantMessages, modelParameters);
        });
    }

    private static IAgentCall BuildCall(
        SeedGraph graph,
        Guid[] conversationIds,
        IAgentCall.CreateExisting createExisting,
        ICompletion.Create createCompletion,
        Random rng,
        DateTimeOffset start,
        TimeSpan span,
        SeedOptions options)
    {
        IAgent agent = graph.Agents[rng.Next(graph.Agents.Count)];
        IAgentVersion version = agent.CurrentVersion;
        IModelEndpoint endpoint = graph.Endpoints[rng.Next(graph.Endpoints.Count)];
        Conversation request = graph.Conversations[rng.Next(graph.Conversations.Count)];
        IModelParameters modelParameters = graph.ModelParameters[rng.Next(graph.ModelParameters.Count)];

        DateTimeOffset createdAt = start + span * rng.NextDouble();
        Guid? conversationId = rng.NextDouble() < options.ConversationRate
            ? conversationIds[rng.Next(conversationIds.Length)]
            : null;

        bool isError = rng.NextDouble() < options.ErrorRate;

        ICompletion? response;
        HttpStatusCode status;
        string? finishReason;
        string? errorMessage;

        if (isError)
        {
            response = null;
            status = rng.NextDouble() < 0.5 ? HttpStatusCode.InternalServerError : HttpStatusCode.TooManyRequests;
            finishReason = null;
            errorMessage = "Upstream provider error";
        }
        else
        {
            ulong input = (ulong)rng.Next(200, 4000);
            ulong output = (ulong)rng.Next(50, 1500);
            ulong cached = (ulong)(input * rng.NextDouble() * 0.5);
            var usage = new TokenUsage(input, output, cached);
            var latency = TimeSpan.FromMilliseconds(rng.Next(150, 6000));
            AssistantMessage message = graph.AssistantMessages[rng.Next(graph.AssistantMessages.Count)];
            response = createCompletion(message, usage, latency);
            status = HttpStatusCode.OK;
            finishReason = "stop";
            errorMessage = null;
        }

        var data = new SeedEntityData(Guid.NewGuid(), createdAt, createdAt);
        return createExisting(
            agent: agent,
            version: version,
            endpoint: endpoint,
            request: request,
            response: response,
            httpStatus: status,
            finishReason: finishReason,
            errorMessage: errorMessage,
            modelParameters: modelParameters,
            existing: data,
            conversationId: conversationId);
    }

    private sealed record SeedGraph(
        Guid ProjectId,
        Guid ProviderId,
        IReadOnlyList<IAgent> Agents,
        IReadOnlyList<IModelEndpoint> Endpoints,
        IReadOnlyList<Conversation> Conversations,
        IReadOnlyList<AssistantMessage> AssistantMessages,
        IReadOnlyList<IModelParameters> ModelParameters);

    private sealed record SeedEntityData(Guid Id, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt) : IDomainEntityData;
}
