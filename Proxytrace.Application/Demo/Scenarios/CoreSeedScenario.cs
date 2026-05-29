using System.Net;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Tools;
using Proxytrace.Domain.Usage;
using Proxytrace.Domain.User;
// ReSharper disable InconsistentNaming

namespace Proxytrace.Application.Demo.Scenarios;

internal sealed class CoreSeedScenario : IDemoScenario
{
    private readonly KioskOptions kiosk;
    private readonly DemoSeedContext ctx;
    private readonly IUser.CreateNew userFactory;
    private readonly IModelProvider.CreateNew providerFactory;
    private readonly IModel.CreateNew modelFactory;
    private readonly IModelEndpoint.CreateNew endpointFactory;
    private readonly IRepository<IModelProvider> providers;
    private readonly IRepository<IModel> models;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly IProject.CreateNew projectFactory;
    private readonly IRepository<IProject> projects;
    private readonly IPromptTemplate.Create promptFactory;
    private readonly IModelParameters.Create paramsFactory;
    private readonly IAgent.CreateNew agentFactory;
    private readonly IAgentCall.CreateNew agentCallFactory;
    private readonly ICompletion.Create completionFactory;

    public CoreSeedScenario(
        KioskOptions kiosk,
        DemoSeedContext ctx,
        IUser.CreateNew userFactory,
        IModelProvider.CreateNew providerFactory,
        IModel.CreateNew modelFactory,
        IModelEndpoint.CreateNew endpointFactory,
        IRepository<IModelProvider> providers,
        IRepository<IModel> models,
        IRepository<IModelEndpoint> endpoints,
        IProject.CreateNew projectFactory,
        IRepository<IProject> projects,
        IPromptTemplate.Create promptFactory,
        IModelParameters.Create paramsFactory,
        IAgent.CreateNew agentFactory,
        IAgentCall.CreateNew agentCallFactory,
        ICompletion.Create completionFactory)
    {
        this.kiosk = kiosk;
        this.ctx = ctx;
        this.userFactory = userFactory;
        this.providerFactory = providerFactory;
        this.modelFactory = modelFactory;
        this.endpointFactory = endpointFactory;
        this.providers = providers;
        this.models = models;
        this.endpoints = endpoints;
        this.projectFactory = projectFactory;
        this.projects = projects;
        this.promptFactory = promptFactory;
        this.paramsFactory = paramsFactory;
        this.agentFactory = agentFactory;
        this.agentCallFactory = agentCallFactory;
        this.completionFactory = completionFactory;
    }

    public int Order => 0;

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var demoUser = await userFactory(
            kiosk.DemoUserEmail,
            externalSubject: null,
            passwordHash: "kiosk-no-login",
            role: UserRole.Member).AddAsync(cancellationToken);

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

        var project = await projects.AddAsync(projectFactory(
            "Showcase Project",
            gpt4oMiniEndpoint,
            [demoUser]), cancellationToken);

        var lookupOrderTool = new ToolSpecification(
            name: "lookup_order",
            description: "Look up the status of a customer order by its numeric id.",
            arguments: ToolArguments.FromJsonSchema(
                """{"type":"object","properties":{"order_id":{"type":"string","description":"The order id, e.g. 12831"}},"required":["order_id"]}"""));

        var startReturnTool = new ToolSpecification(
            name: "start_return",
            description: "Open a return for a previously delivered order.",
            arguments: ToolArguments.FromJsonSchema(
                """{"type":"object","properties":{"order_id":{"type":"string"},"reason":{"type":"string","enum":["damaged","wrong_item","no_longer_needed"]}},"required":["order_id","reason"]}"""));

        var supportAgent = await agentFactory(
            "Customer Support Agent",
            promptFactory("support-system",
                "You are a friendly, concise customer-support agent for an e-commerce store. "
                + "Always acknowledge the issue, propose a clear next step, and close politely. "
                + "Use the `lookup_order` and `start_return` tools when a customer references an order id."),
            tools: [lookupOrderTool, startReturnTool],
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
                    version: agent.CurrentVersion,
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

        await SeedToolCallConversation(supportAgent, gpt4oEndpoint);
        await SeedMultiTurnConversation(supportAgent, gpt4oEndpoint);
        await SeedMultiTurnConversation(analyticsAgent, gpt4oEndpoint, analyticsMultiTurn: true);

        async Task SeedToolCallConversation(IAgent agent, IModelEndpoint endpoint)
        {
            var conversationId = Guid.NewGuid();
            var systemMsg = agent.CreateSystemMessage();
            var userMsg = new UserMessage([Content.FromText("Where is my order #18342?")]);

            var toolCallId = "call_lookup_18342";
            var toolRequest = new ToolRequest(
                id: toolCallId,
                name: "lookup_order",
                arguments: """{"order_id":"18342"}""");

            var assistantToolMsg = new AssistantMessage([], [toolRequest]);

            var turn1Request = new Conversation([systemMsg, userMsg]);
            var turn1Completion = completionFactory(
                assistantToolMsg,
                new TokenUsage(248, 32),
                TimeSpan.FromMilliseconds(540));

            await agentCallFactory(
                agent: agent, version: agent.CurrentVersion,
                endpoint: endpoint,
                request: turn1Request,
                response: turn1Completion,
                httpStatus: HttpStatusCode.OK,
                finishReason: "tool_calls",
                errorMessage: null,
                modelParameters: paramsFactory(temperature: 0.3),
                conversationId: conversationId).AddAsync(cancellationToken);

            var toolResponse = new ToolResponse(
                toolRequest,
                [Content.FromText("""{"order_id":"18342","status":"in_transit","carrier":"UPS","eta":"2026-05-16","tracking":"1Z999AA10123456784"}""")]);
            var toolMsg = new ToolMessage(toolResponse);

            var finalAssistant = new AssistantMessage(
                [Content.FromText("Order #18342 is in transit with UPS, ETA 2026-05-16. Tracking: 1Z999AA10123456784. Anything else?")],
                []);

            var turn2Request = new Conversation([systemMsg, userMsg, assistantToolMsg, toolMsg]);
            var turn2Completion = completionFactory(
                finalAssistant,
                new TokenUsage(312, 58),
                TimeSpan.FromMilliseconds(710));

            await agentCallFactory(
                agent: agent, version: agent.CurrentVersion,
                endpoint: endpoint,
                request: turn2Request,
                response: turn2Completion,
                httpStatus: HttpStatusCode.OK,
                finishReason: "stop",
                errorMessage: null,
                modelParameters: paramsFactory(temperature: 0.3),
                conversationId: conversationId).AddAsync(cancellationToken);

            // Second tool-call conversation: start_return
            var convId2 = Guid.NewGuid();
            var systemMsg2 = agent.CreateSystemMessage();
            var userMsg2 = new UserMessage([Content.FromText("Order #20114 arrived damaged. Please start a return.")]);

            var returnCallId = "call_return_20114";
            var returnRequest = new ToolRequest(
                id: returnCallId,
                name: "start_return",
                arguments: """{"order_id":"20114","reason":"damaged"}""");
            var assistantReturnMsg = new AssistantMessage([], [returnRequest]);

            var convReq1 = new Conversation([systemMsg2, userMsg2]);
            var convComp1 = completionFactory(
                assistantReturnMsg,
                new TokenUsage(261, 38),
                TimeSpan.FromMilliseconds(602));
            await agentCallFactory(
                agent: agent, version: agent.CurrentVersion,
                endpoint: endpoint,
                request: convReq1,
                response: convComp1,
                httpStatus: HttpStatusCode.OK,
                finishReason: "tool_calls",
                errorMessage: null,
                modelParameters: paramsFactory(temperature: 0.3),
                conversationId: convId2).AddAsync(cancellationToken);

            var returnResponse = new ToolResponse(
                returnRequest,
                [Content.FromText("""{"return_id":"RMA-7741","label_url":"https://shop.example.com/labels/RMA-7741","refund_estimate_days":3}""")]);
            var returnToolMsg = new ToolMessage(returnResponse);
            var finalReturnAssistant = new AssistantMessage(
                [Content.FromText("Return RMA-7741 created for order #20114. Label: https://shop.example.com/labels/RMA-7741. Refund issued within 3 business days of receipt.")],
                []);

            var convReq2 = new Conversation([systemMsg2, userMsg2, assistantReturnMsg, returnToolMsg]);
            var convComp2 = completionFactory(
                finalReturnAssistant,
                new TokenUsage(338, 71),
                TimeSpan.FromMilliseconds(795));
            await agentCallFactory(
                agent: agent, version: agent.CurrentVersion,
                endpoint: endpoint,
                request: convReq2,
                response: convComp2,
                httpStatus: HttpStatusCode.OK,
                finishReason: "stop",
                errorMessage: null,
                modelParameters: paramsFactory(temperature: 0.3),
                conversationId: convId2).AddAsync(cancellationToken);
        }

        async Task SeedMultiTurnConversation(IAgent agent, IModelEndpoint endpoint, bool analyticsMultiTurn = false)
        {
            var conversationId = Guid.NewGuid();
            var system = agent.CreateSystemMessage();

            var turns = analyticsMultiTurn
                ? new (string user, string assistant, ulong inTok, ulong outTok, int latencyMs)[]
                {
                    ("How many signups did we have in April 2026?",
                        "April 2026 signups: 4,812.\n```sql\nSELECT COUNT(*) FROM users WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01';\n```",
                        298, 112, 920),
                    ("Break that down by acquisition channel.",
                        "By channel: organic 2,104, paid_search 1,388, referral 812, social 508.\n```sql\nSELECT channel, COUNT(*) FROM users\nWHERE created_at >= '2026-04-01' AND created_at < '2026-05-01'\nGROUP BY channel ORDER BY 2 DESC;\n```",
                        414, 168, 1180),
                    ("Which channel had the highest 7-day retention?",
                        "Referral led at 41 % D7 retention, vs. organic 33 %, paid_search 22 %, social 19 %.\n```sql\nSELECT channel,\n  AVG(CASE WHEN last_active_at >= created_at + INTERVAL '7 days' THEN 1.0 ELSE 0 END) AS d7\nFROM users WHERE created_at BETWEEN '2026-04-01' AND '2026-04-30'\nGROUP BY channel ORDER BY d7 DESC;\n```",
                        522, 224, 1410),
                }
                : new (string user, string assistant, ulong inTok, ulong outTok, int latencyMs)[]
                {
                    ("Hi, I need help with order #19120.",
                        "Hi — happy to help with order #19120. What's the issue?",
                        232, 28, 410),
                    ("It says delivered but I never received it.",
                        "Sorry to hear that. I'll mark #19120 as a non-delivery, open a carrier trace, and issue a replacement. Want the replacement to the original address or a new one?",
                        298, 84, 720),
                    ("Same address is fine. How long will it take?",
                        "Replacement for #19120 is scheduled for dispatch tomorrow morning, ETA 2–3 business days. You'll get tracking by email. Anything else?",
                        372, 76, 690),
                };

            var history = new List<Message> { system };
            foreach (var t in turns)
            {
                var user = new UserMessage([Content.FromText(t.user)]);
                history.Add(user);

                var request = new Conversation(history.ToArray());
                var assistant = new AssistantMessage([Content.FromText(t.assistant)], []);
                var completion = completionFactory(
                    assistant,
                    new TokenUsage(t.inTok, t.outTok),
                    TimeSpan.FromMilliseconds(t.latencyMs));

                await agentCallFactory(
                    agent: agent, version: agent.CurrentVersion,
                    endpoint: endpoint,
                    request: request,
                    response: completion,
                    httpStatus: HttpStatusCode.OK,
                    finishReason: "stop",
                    errorMessage: null,
                    modelParameters: paramsFactory(temperature: 0.3),
                    conversationId: conversationId).AddAsync(cancellationToken);

                history.Add(assistant);
            }
        }

        ctx.DemoUser = demoUser;
        ctx.Project = project;
        ctx.Gpt4oEndpoint = gpt4oEndpoint;
        ctx.Gpt4oMiniEndpoint = gpt4oMiniEndpoint;
        ctx.ClaudeEndpoint = claudeEndpoint;
        ctx.CustomerSupportAgent = supportAgent;
        ctx.CodeReviewAgent = codeReviewAgent;
        ctx.DataAnalyticsAgent = analyticsAgent;
    }
}
