# Domain Concepts

The domain (`Proxytrace.Domain/`) currently models:

- **User, Project** — Tenancy. `Project` references one `IModelEndpoint` (`SystemEndpoint`) used by built-in system agents (e.g. agent-name generation, optimizers).
- **Agent** — An AI agent: `Name`, `SystemPrompt` (`IPromptTemplate`), `Tools` (`IReadOnlyList<ToolSpecification>`), `Endpoint` (`IModelEndpoint`), `Project`, `IsSystemAgent` flag.
- **AgentCall** — A captured LLM interaction (one trace entry).
- **ModelProvider, Model, ModelEndpoint** — `ModelProvider` is the upstream API (OpenAI, Anthropic, …). `ModelEndpoint` pairs a `Model` with a `ModelProvider` and stores per-token costs (`InputTokenCost`, `OutputTokenCost`); has `CalculateCost(TokenUsage)`.
- **ApiKey** — Proxytrace-issued key for clients hitting the OpenAI proxy. Tied to a `Project` + `ModelProvider`.
- **TestSuite, TestCase** — Curated benchmark inputs. `TestSuite` has N:M with `IEvaluator` (junction `TestSuiteEvaluatorEntity`).
- **TestRun, TestRunGroup, TestResult** — Execution records of a suite against an agent.
- **Evaluator** (base) + concrete subtypes (`IExactMatchEvaluator`, `INumericMatchEvaluator`, `IJsonSchemaMatchEvaluator`, `IToolUsageEvaluator`, `IHelpfulnessEvaluator`, `ISafetyClassifier`, `IPolitenessEvaluator`, `ICustomEvaluator`, plus the LLM-based `IAgenticEvaluator` group). Each `EvaluateAsync(ITestResult)` returns an `IEvaluation` (domain object).
- **OptimizationProposal** — Suggestion to improve an agent: `Kind`, `Status` (Review/Approved/Rejected), `Priority`, `Rationale`, typed `ProposalDetails` (e.g. `SwitchModelProposal`, `UpdateSystemPromptProposal`), `EvidenceTestRunIds`.
- **Notification** — Multi-purpose, user-facing alert shown on the dashboard (and, in future, other channels): `Kind` (`Anomaly`, `ProposalReady`), `Severity` (Info/Warning/Critical), `Title`, `Message`, `Status` (Unread/Read/Dismissed), optional `ProjectId` scope, and an optional soft `TargetKind`/`TargetId` deep-link reference. Raised today by anomaly detection via `INotificationService`/`INotificationChannel` (`Proxytrace.Application/Notifications/`, `Anomaly/`).
- **Domain objects (no storage):** `IPromptTemplate`, `IPrompt`, `Message` + role-specific subtypes (`SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolMessage`), `Conversation`, `ToolSpecification`/`ToolArguments`/`ToolRequest`/`ToolResponse`, `TokenUsage`, `ICompletion`, `IEvaluation`.
