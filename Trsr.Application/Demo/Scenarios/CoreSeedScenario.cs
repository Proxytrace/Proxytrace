using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Completion;
using Trsr.Domain.Inference;
using Trsr.Domain.Message;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Usage;
using Trsr.Domain.User;
// ReSharper disable InconsistentNaming

namespace Trsr.Application.Demo.Scenarios;

internal sealed class CoreSeedScenario : IDemoScenario
{
    public int Order => 0;

    public async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var kiosk = services.GetRequiredService<KioskOptions>();

        services.GetRequiredService<IRepository<IUser>>();
        var userFactory = services.GetRequiredService<IUser.CreateNew>();
        var demoUser = await userFactory(
            kiosk.DemoUserEmail,
            externalSubject: null,
            passwordHash: "kiosk-no-login",
            role: UserRole.Member).AddAsync(cancellationToken);

        var providerFactory = services.GetRequiredService<IModelProvider.CreateNew>();
        var modelFactory = services.GetRequiredService<IModel.CreateNew>();
        var endpointFactory = services.GetRequiredService<IModelEndpoint.CreateNew>();
        var providers = services.GetRequiredService<IRepository<IModelProvider>>();
        var models = services.GetRequiredService<IRepository<IModel>>();
        var endpoints = services.GetRequiredService<IRepository<IModelEndpoint>>();

        var openAiProvider = await providers.AddAsync(providerFactory(
            "OpenAI (demo)",
            new Uri("https://api.openai.com/v1"),
            "DEMO-NO-KEY",
            ModelProviderKind.OpenAi), cancellationToken);

        var anthropicProvider = await providers.AddAsync(providerFactory(
            "Anthropic (demo)",
            new Uri("https://api.anthropic.com/v1"),
            "DEMO-NO-KEY",
            ModelProviderKind.Anthropic), cancellationToken);

        var gpt4o = await models.AddAsync(modelFactory("gpt-4o"), cancellationToken);
        var gpt4oMini = await models.AddAsync(modelFactory("gpt-4o-mini"), cancellationToken);
        var claudeSonnet = await models.AddAsync(modelFactory("claude-sonnet-4.5"), cancellationToken);

        var gpt4oEndpoint = await endpoints.AddAsync(endpointFactory(gpt4o, openAiProvider,
            inputTokenCost: 0.0000025m, outputTokenCost: 0.00001m), cancellationToken);
        var gpt4oMiniEndpoint = await endpoints.AddAsync(endpointFactory(gpt4oMini, openAiProvider,
            inputTokenCost: 0.00000015m, outputTokenCost: 0.0000006m), cancellationToken);
        var claudeEndpoint = await endpoints.AddAsync(endpointFactory(claudeSonnet, anthropicProvider,
            inputTokenCost: 0.000003m, outputTokenCost: 0.000015m), cancellationToken);

        var projectFactory = services.GetRequiredService<IProject.CreateNew>();
        var projects = services.GetRequiredService<IRepository<IProject>>();
        var project = await projects.AddAsync(projectFactory(
            "Showcase Project",
            gpt4oMiniEndpoint,
            [demoUser]), cancellationToken);

        var promptFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var paramsFactory = services.GetRequiredService<IModelParameters.Create>();
        var agentFactory = services.GetRequiredService<IAgent.CreateNew>();

        var supportAgent = await agentFactory(
            "Customer Support Agent",
            promptFactory("support-system",
                "You are a friendly, concise customer-support agent for an e-commerce store. "
                + "Always acknowledge the issue, propose a clear next step, and close politely."),
            tools: [],
            endpoint: gpt4oEndpoint,
            project: project,
            modelParameters: paramsFactory(temperature: 0.3),
            isSystemAgent: false).AddAsync(cancellationToken);

        var codeReviewAgent = await agentFactory(
            "Code Review Agent",
            promptFactory("code-review-system",
                "You are a senior software engineer reviewing pull requests. "
                + "Identify correctness, security, and clarity issues. Be specific, cite line numbers."),
            tools: [],
            endpoint: claudeEndpoint,
            project: project,
            modelParameters: paramsFactory(temperature: 0.2),
            isSystemAgent: false).AddAsync(cancellationToken);

        var analyticsAgent = await agentFactory(
            "Data Analytics Agent",
            promptFactory("analytics-system",
                "You are a data analyst. Given a question and a table description, "
                + "answer with a short summary and a SQL query."),
            tools: [],
            endpoint: gpt4oEndpoint,
            project: project,
            modelParameters: paramsFactory(temperature: 0.1),
            isSystemAgent: false).AddAsync(cancellationToken);

        var agentCallFactory = services.GetRequiredService<IAgentCall.CreateNew>();
        var completionFactory = services.GetRequiredService<ICompletion.Create>();

        var supportSamples = new (string user, string assistant, ulong inTok, ulong outTok, int latencyMs)[]
        {
            ("My order #12831 hasn't shipped yet, it's been 6 days.",
                "Sorry for the delay on order #12831 — I see it's still in our warehouse. I've flagged it for expedited shipping today and emailed you the new tracking link. Anything else?",
                312, 96, 820),
            ("I want to return a defective blender, what do I do?",
                "Got it — sorry the blender arrived defective. You can start a return at /returns, select 'Damaged on arrival', and we'll cover the shipping label. You'll see a refund within 3 business days of us receiving it.",
                289, 102, 740),
            ("Do you ship to Germany?",
                "Yes, we ship to Germany. Standard delivery is 5–7 business days, express is 2–3. Duties and VAT are calculated at checkout.",
                204, 64, 510),
            ("My discount code FALL20 isn't working at checkout.",
                "FALL20 expired on 2026-04-30. The current code is SPRING15 for 15% off. Want me to apply it to your cart?",
                256, 71, 612),
            ("Can I change the address on order #14021?",
                "Order #14021 is still in 'Preparing' so I can update the shipping address. Please reply with the new address and I'll change it right away.",
                231, 78, 588),
            ("Your website crashed when I tried to pay.",
                "Apologies for that — could you share the browser and the error message you saw? In the meantime your cart is saved, and you can retry checkout at any time.",
                221, 88, 654),
        };

        var reviewSamples = new (string user, string assistant, ulong inTok, ulong outTok, int latencyMs)[]
        {
            ("Please review this diff: added a global mutable cache to UserService.",
                "Concern: a static mutable cache in UserService introduces a process-wide race and breaks scoped DI semantics. Prefer IMemoryCache injected at the scope you actually want. If you keep it static, every entry must be immutable and key collisions across tenants must be impossible.",
                412, 188, 1432),
            ("Review: changed JWT signing key reading to ENV with no fallback.",
                "Good direction — removing the hardcoded fallback closes a real risk. Add a startup assertion: fail fast if the env var is empty, instead of letting a zero-length key reach the JWT library, which silently accepts it on some versions.",
                388, 142, 1188),
            ("Review: parallel `await Task.WhenAll` over user.GetOrdersAsync(...) in a foreach.",
                "Two issues: (1) `GetOrdersAsync` hits EF Core; the same DbContext doesn't support concurrent operations and will throw. Materialize sequentially or open a context per task. (2) `WhenAll` swallows all but the first exception — wrap and aggregate.",
                502, 221, 1810),
        };

        var analyticsSamples = new (string user, string assistant, ulong inTok, ulong outTok, int latencyMs)[]
        {
            ("How many active users did we have last week?",
                "Active users in the last 7 full days: 18,432.\n```sql\nSELECT COUNT(DISTINCT user_id)\nFROM events\nWHERE event_at >= now() - INTERVAL '7 days';\n```",
                301, 124, 980),
            ("Top 5 SKUs by revenue in May 2026?",
                "Top 5 SKUs by revenue, May 2026: SKU-A88 ($142k), SKU-C12 ($118k), SKU-B07 ($94k), SKU-A91 ($82k), SKU-D34 ($71k).\n```sql\nSELECT sku, SUM(line_total) AS revenue\nFROM order_lines\nWHERE order_at BETWEEN '2026-05-01' AND '2026-05-31'\nGROUP BY sku ORDER BY revenue DESC LIMIT 5;\n```",
                344, 198, 1260),
        };

        async Task SeedTraces(
            IAgent agent,
            IModelEndpoint endpoint,
            (string user, string assistant, ulong inTok, ulong outTok, int latencyMs)[] samples,
            int spreadHours)
        {
            foreach (var s in samples)
            {
                var request = new Conversation([
                    agent.CreateSystemMessage(),
                    new UserMessage([Content.FromText(s.user)])
                ]);
                var response = new AssistantMessage(
                    [Content.FromText(s.assistant)],
                    []);
                var completion = completionFactory(
                    response,
                    new TokenUsage(s.inTok, s.outTok),
                    TimeSpan.FromMilliseconds(s.latencyMs));

                await agentCallFactory(
                    agent: agent,
                    endpoint: endpoint,
                    request: request,
                    response: completion,
                    httpStatus: HttpStatusCode.OK,
                    finishReason: "stop",
                    errorMessage: null,
                    modelParameters: paramsFactory(temperature: 0.3),
                    conversationId: null).AddAsync(cancellationToken);
            }
            _ = spreadHours;
        }

        await SeedTraces(supportAgent, gpt4oEndpoint, supportSamples, spreadHours: 48);
        await SeedTraces(codeReviewAgent, claudeEndpoint, reviewSamples, spreadHours: 72);
        await SeedTraces(analyticsAgent, gpt4oEndpoint, analyticsSamples, spreadHours: 36);

        _ = supportAgent;
        _ = codeReviewAgent;
        _ = analyticsAgent;
    }
}
