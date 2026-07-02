using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.TestCase;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Application.Demo.Scenarios;

internal sealed class TestSuiteSeedScenario : IDemoScenario
{
    private readonly DemoSeedContext ctx;
    private readonly ITestCase.CreateNew createTestCase;
    private readonly ITestSuite.CreateNew createTestSuite;
    private readonly IRepository<ITestCase> caseRepo;
    private readonly IRepository<ITestSuite> suiteRepo;

    public TestSuiteSeedScenario(
        DemoSeedContext ctx,
        ITestCase.CreateNew createTestCase,
        ITestSuite.CreateNew createTestSuite,
        IRepository<ITestCase> caseRepo,
        IRepository<ITestSuite> suiteRepo)
    {
        this.ctx = ctx;
        this.createTestCase = createTestCase;
        this.createTestSuite = createTestSuite;
        this.caseRepo = caseRepo;
        this.suiteRepo = suiteRepo;
    }

    public int Order => 20;

    private sealed record CaseSpec(
        string UserMessage,
        string ExpectedAssistantReply,
        ToolRequest? ToolCall = null,
        string? ToolResult = null);

    private sealed record SuiteSpec(
        string Key,
        string Name,
        IAgent Agent,
        IReadOnlyCollection<IEvaluator> Evaluators,
        IReadOnlyCollection<CaseSpec> Cases);

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var support = ctx.RequireCustomerSupportAgent();
        var review = ctx.RequireCodeReviewAgent();
        var analytics = ctx.RequireDataAnalyticsAgent();
        var triage = ctx.RequireEmailTriageAgent();
        var helpfulness = ctx.RequireHelpfulness();
        var politeness = ctx.RequirePoliteness();

        var specs = new SuiteSpec[]
        {
            new(
                Key: "customer-support-tone",
                Name: "Customer Support — Tone & Empathy",
                Agent: support,
                Evaluators: [helpfulness, politeness],
                Cases:
                [
                    new("My package never arrived and I'm furious.",
                        "I'm really sorry about that — losing track of a package is frustrating. I'm opening a trace request right now and will email you within 24 hours with either the package location or a full refund."),
                    new("I waited 40 minutes on hold for nothing.",
                        "That's a genuinely awful experience and I apologize. I'll handle your issue here so you don't have to call again — what's the order number?"),
                    new("Why is your support so slow?",
                        "You're right that response times have been longer than they should be lately and I'm sorry. I'm here now and will see this through with you. What can I help with?"),
                    new("I'd like to compliment your team — order arrived early!",
                        "That's lovely to hear, thank you — I'll pass it on to the warehouse crew. Anything else I can help with today?"),
                    new("Is there a way to talk to a human?",
                        "You're talking to one — I'm a support agent and happy to help. What's going on?"),
                    new("Hi, I forgot what my discount code was.",
                        "No problem at all. Your active code is SPRING15 for 15% off your next order. Want me to apply it for you?"),
                ]),
            new(
                Key: "customer-support-refunds",
                Name: "Customer Support — Refund Policy Accuracy",
                Agent: support,
                Evaluators: [helpfulness],
                Cases:
                [
                    new("I bought a blender 45 days ago. Can I still return it?",
                        "Our return window is 30 days from delivery, so a 45-day-old purchase is outside the standard policy. I can still offer a one-time store credit of 50% as a goodwill gesture — would that work?"),
                    new("My item was damaged in shipping, do I pay for return shipping?",
                        "No — when items arrive damaged we cover the return label and issue a full refund as soon as the item is scanned by the carrier."),
                    new("I want a refund for a digital download I already used.",
                        "Digital downloads aren't refundable once accessed, per the terms at checkout. If the file was defective or wouldn't open, I can absolutely re-issue or refund — was that the case?"),
                    new("How long until I see the refund on my card?",
                        "Once we receive and inspect the return, refunds post within 3 business days on our end. Your bank may take an additional 2–5 days to display it."),
                    new("Can I get a refund to a different card than I paid with?",
                        "Refunds must go back to the original payment method for fraud-prevention reasons. If that card is closed, your bank will typically forward the refund to your new account automatically."),
                ]),
            new(
                Key: "code-review-bugs",
                Name: "Code Review — Bug Detection",
                Agent: review,
                Evaluators: [helpfulness],
                Cases:
                [
                    new("Review: `for (int i = 0; i <= items.Length; i++) sum += items[i];`",
                        "Off-by-one: `<=` walks past the last index and will throw `IndexOutOfRangeException`. Use `<` or iterate the collection directly with `foreach`."),
                    new("Review: `if (user.Role = Role.Admin) { ... }`",
                        "Assignment in condition: `=` instead of `==` assigns `Role.Admin` to `user.Role` and evaluates the assignment. Use `==`, and consider `is` for nullable comparisons."),
                    new("Review: `Task.Run(() => httpClient.GetAsync(url)).Result;`",
                        "Two problems: (1) `.Result` on an async call inside `Task.Run` deadlocks under sync contexts (older ASP.NET, WPF). (2) `HttpClient.GetAsync` doesn't need `Task.Run`. Just `await httpClient.GetAsync(url)`."),
                    new("Review: a method returns `IEnumerable<T>` from inside a `using (var db = ...)` block.",
                        "The `using` disposes the context before the caller enumerates. Either materialize with `ToArray()`/`ToList()` before returning, or change the lifetime so the context outlives enumeration."),
                    new("Review: SQL `WHERE name = '\" + input + \"'`",
                        "Classic SQL injection. Concatenated user input goes straight to the database. Use parameters: `WHERE name = @name` and bind `input` as a parameter."),
                    new("Review: a Dictionary indexed by a mutable record key.",
                        "If the record's properties change after insertion, the hash drifts from the bucket and lookups silently miss. Either make the key fields `init`-only or use an immutable wrapper for the key."),
                    new("Review: `catch (Exception) { /* ignore */ }` around a database write.",
                        "Swallowing all exceptions hides real failures (deadlocks, connection drops) and leaves the caller believing the write succeeded. Log at minimum, and re-throw or return a typed failure result."),
                ]),
            new(
                Key: "code-review-style",
                Name: "Code Review — Tone in Feedback",
                Agent: review,
                Evaluators: [politeness],
                Cases:
                [
                    new("Review this PR description: 'fixed stuff'.",
                        "Could you expand the description a bit? Even one line per change helps future readers — what stuff was fixed, and why. No rush."),
                    new("Review: contributor pushed a huge formatting-only diff with the feature change.",
                        "Lovely cleanup overall — would you mind splitting the formatting churn into its own commit so the feature diff is easier to review? Happy to take it as-is if that's a hassle."),
                    new("Review: junior dev's first PR has a small bug.",
                        "Really nice first PR, thanks for sending it. One small thing: the loop reads one past the end of the array — let me know if you'd like me to walk through it together."),
                    new("Review: senior pushed code without tests.",
                        "I think this change deserves a test or two given how it interacts with billing. Would you be open to adding coverage before we merge, or want me to take a stab?"),
                    new("Review: someone removed your code without explanation.",
                        "I noticed the helper I added got removed in this change — could you share the reasoning? Happy to be wrong about it, just want to make sure we're not losing the edge case it handled."),
                ]),
            new(
                Key: "data-analytics-queries",
                Name: "Data Analytics — SQL Correctness",
                Agent: analytics,
                Evaluators: [helpfulness],
                Cases:
                [
                    new("Give me total revenue last month.",
                        "Total revenue for the prior calendar month:\n```sql\nSELECT SUM(line_total) AS revenue\nFROM order_lines\nWHERE order_at >= date_trunc('month', now() - INTERVAL '1 month')\n  AND order_at <  date_trunc('month', now());\n```"),
                    new("How many distinct customers ordered yesterday?",
                        "```sql\nSELECT COUNT(DISTINCT customer_id) AS customers\nFROM orders\nWHERE order_at::date = (now() - INTERVAL '1 day')::date;\n```"),
                    new("7-day rolling DAU for the past month.",
                        "```sql\nSELECT day,\n       COUNT(DISTINCT user_id) FILTER (\n           WHERE event_at >= day - INTERVAL '6 days'\n             AND event_at <  day + INTERVAL '1 day') AS rolling_dau\nFROM generate_series(now() - INTERVAL '30 days', now(), '1 day') AS day\nJOIN events ON event_at < day + INTERVAL '1 day'\nGROUP BY day ORDER BY day;\n```"),
                    new("Top 10 referring domains in the last week.",
                        "```sql\nSELECT referrer_domain, COUNT(*) AS visits\nFROM page_views\nWHERE viewed_at >= now() - INTERVAL '7 days'\nGROUP BY referrer_domain\nORDER BY visits DESC LIMIT 10;\n```"),
                    new("Average basket size per channel this quarter.",
                        "```sql\nSELECT channel, AVG(item_count) AS avg_basket_size\nFROM orders\nWHERE order_at >= date_trunc('quarter', now())\nGROUP BY channel;\n```"),
                    new("Conversion rate from signup to first purchase.",
                        "```sql\nSELECT 1.0 * COUNT(o.user_id) / NULLIF(COUNT(u.id), 0) AS conversion_rate\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\n             AND o.order_at = (\n                 SELECT MIN(order_at) FROM orders o2 WHERE o2.user_id = u.id\n             );\n```"),
                    new("Median session duration today.",
                        "```sql\nSELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS median_seconds\nFROM sessions\nWHERE started_at::date = now()::date;\n```"),
                    new("Churned users (no order in 60 days) who used to be weekly buyers.",
                        "```sql\nSELECT user_id\nFROM orders\nGROUP BY user_id\nHAVING MAX(order_at) < now() - INTERVAL '60 days'\n   AND COUNT(*) FILTER (\n       WHERE order_at BETWEEN now() - INTERVAL '180 days' AND now() - INTERVAL '60 days'\n   ) >= 12;\n```"),
                ]),
            // Exercises the deliberately defective Email Triage agent. Cases are ordered easiest
            // first: the run seeder passes a prefix of the list, so the two ambiguous cases at the
            // end fail in every seeded run — the "hard to optimize" long tail the theories chase.
            //
            // The agent carries a `search_kb` tool and its prompt tells it to use it, but the test
            // runner performs a single completion per case with no tool loop — so every case embeds
            // the search_kb round-trip (assistant tool call + tool result) in its input
            // conversation. A live re-run then lands on the final text turn instead of stalling on
            // a tool-call response the evaluators would fail wholesale; the two hard cases at the
            // end still fail on their actual ambiguity (sarcasm, mixed language), not on tooling.
            new(
                Key: "email-triage-priority",
                Name: "Email Triage — Category & Priority",
                Agent: triage,
                Evaluators: [helpfulness],
                Cases:
                [
                    new("Subject: Can't log in since this morning, 'invalid credentials' on every attempt. Nobody on our team can access the workspace.",
                        "Category: Outage. Priority: P1. Multiple users locked out of a workspace is a potential incident (KB-501) — escalate to on-call and acknowledge the customer within 15 minutes.",
                        new ToolRequest(id: "case_kb_login_outage", name: "search_kb", arguments: """{"query":"workspace login failing invalid credentials all users"}"""),
                        """{"articles":[{"id":"KB-501","title":"Diagnosing workspace-wide login failures","url":"https://help.example.com/kb/501"}]}"""),
                    new("Subject: Invoice #8841 charges us for 25 seats but we only have 19 users.",
                        "Category: Billing. Priority: P2. Seat-count disputes are refund-relevant — route to billing with the invoice id, link KB-233 for how seats are counted, and confirm the current seat count from the account record; never guess plan or seat details.",
                        new ToolRequest(id: "case_kb_invoice_seats", name: "search_kb", arguments: """{"query":"invoice seat count billing"}"""),
                        """{"articles":[{"id":"KB-233","title":"How seat counting works on invoices","url":"https://help.example.com/kb/233"}]}"""),
                    new("Subject: The CSV export button greys out for reports longer than 10k rows.",
                        "Category: Bug. Priority: P2. Reproducible functional defect with a workaround — point the customer at smaller date ranges per KB-118, file with steps to reproduce and link the existing export-limit ticket if one exists.",
                        new ToolRequest(id: "case_kb_csv_export", name: "search_kb", arguments: """{"query":"CSV export button disabled large reports"}"""),
                        """{"articles":[{"id":"KB-118","title":"Exporting tables as CSV","url":"https://help.example.com/kb/118"}]}"""),
                    new("Subject: Love the product! Would be great to have Slack notifications for failed syncs.",
                        "Category: Feature Request. Priority: P4. No help article covers Slack notifications, so it doesn't exist today — thank the customer, log the request against the notifications backlog, no commitment on timeline.",
                        new ToolRequest(id: "case_kb_slack_notify", name: "search_kb", arguments: """{"query":"Slack notifications for failed syncs"}"""),
                        """{"articles":[]}"""),
                    new("Subject: REMINDER 3rd email!! Still waiting on my data deletion request from May 2nd.",
                        "Category: Compliance. Priority: P1. An unanswered GDPR deletion request is time-boxed by law (KB-610) — escalate to the privacy officer immediately and confirm the statutory deadline to the customer.",
                        new ToolRequest(id: "case_kb_gdpr_deletion", name: "search_kb", arguments: """{"query":"data deletion request GDPR deadline"}"""),
                        """{"articles":[{"id":"KB-610","title":"Data deletion requests and statutory deadlines","url":"https://help.example.com/kb/610"}]}"""),
                    new("Subject: How do I add a read-only user to just one dashboard?",
                        "Category: How-To. Priority: P3. Answer directly with KB-152: invite the user with the Viewer role and share the single dashboard via its permissions panel.",
                        new ToolRequest(id: "case_kb_viewer_role", name: "search_kb", arguments: """{"query":"read-only user single dashboard viewer role"}"""),
                        """{"articles":[{"id":"KB-152","title":"Sharing a single dashboard with the Viewer role","url":"https://help.example.com/kb/152"}]}"""),
                    new("Subject: Great job on the new release, everything is *so* fast now that literally nothing loads anymore.",
                        "Category: Outage. Priority: P1. The praise is sarcasm — 'nothing loads anymore' reports a regression after the release. Treat as an incident report, not feedback, and ask for browser/console details.",
                        new ToolRequest(id: "case_kb_release_slow", name: "search_kb", arguments: """{"query":"slow loading after latest release"}"""),
                        """{"articles":[{"id":"KB-095","title":"What's new in the latest release","url":"https://help.example.com/kb/095"}]}"""),
                    new("Subject: Hola, la sincronización falló anoche y perdimos los datos del reporte semanal. ¿Nos pueden ayudar? It's urgent, der Kunde wartet schon.",
                        "Category: Bug. Priority: P1. Mixed-language email reporting data loss on a sync — data loss outranks the casual tone. Reply in the customer's primary language (Spanish) and escalate for data recovery (KB-347).",
                        new ToolRequest(id: "case_kb_sync_failed", name: "search_kb", arguments: """{"query":"sync failed missing report data"}"""),
                        """{"articles":[{"id":"KB-347","title":"Recovering data after a failed sync","url":"https://help.example.com/kb/347"}]}"""),
                ]),
        };

        foreach (var spec in specs)
        {
            var cases = new List<ITestCase>(spec.Cases.Count);
            foreach (var caseSpec in spec.Cases)
            {
                var messages = new List<Message>
                {
                    new UserMessage([Content.FromText(caseSpec.UserMessage)])
                };
                if (caseSpec.ToolCall is not null)
                {
                    messages.Add(new AssistantMessage([], [caseSpec.ToolCall]));
                    messages.Add(new ToolMessage(new ToolResponse(
                        caseSpec.ToolCall,
                        [Content.FromText(caseSpec.ToolResult ?? "")])));
                }
                var input = new Conversation(messages);
                var expected = new AssistantMessage(
                    [Content.FromText(caseSpec.ExpectedAssistantReply)],
                    []);
                var testCase = createTestCase(input, expected);
                cases.Add(await caseRepo.AddAsync(testCase, cancellationToken));
            }

            var suite = createTestSuite(spec.Name, spec.Agent, spec.Evaluators, cases);
            var saved = await suiteRepo.AddAsync(suite, cancellationToken);
            ctx.SuitesByKey[spec.Key] = saved;
        }
    }
}
