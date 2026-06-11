import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface AuthModeDto {
  mode: string;
  setupRequired: boolean;
  legacyClaimAvailable: boolean;
}

export interface TokenResponse {
  token: string;
  expiresAt: string;
}

export interface SetupCompleteResponse {
  providerId: string;
  endpointId: string;
  projectId: string;
  apiKeyValue: string;
}

export interface TheoryDto {
  id: string;
  kind: string;
  status: string;
  source: string;
  agentId: string;
  agentName: string;
  suiteId: string;
  priority: string;
  rationale: string;
  evidenceTestRunIds: string[];
  resultingProposalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ProxytraceApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private token?: string,
  ) {}

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async getAuthMode(): Promise<AuthModeDto> {
    const res = await this.request.get('/api/auth/mode');
    return res.json();
  }

  async setupAdmin(email: string, password: string): Promise<TokenResponse> {
    const res = await this.request.post('/api/auth/setup', {
      data: { email, password },
    });
    if (!res.ok()) throw new Error(`setup failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await this.request.post('/api/auth/login', {
      data: { email, password },
    });
    if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  setToken(token: string) {
    this.token = token;
  }

  async completeSetup(opts: {
    providerName: string;
    providerEndpoint: string;
    providerUpstreamApiKey: string;
    providerKind: string;
    modelName: string;
    projectName: string;
    apiKeyName: string;
  }): Promise<SetupCompleteResponse> {
    const res = await this.request.post('/api/setup/complete', {
      headers: this.headers(),
      data: {
        ...opts,
        inputTokenCost: null,
        outputTokenCost: null,
      },
    });
    if (!res.ok()) throw new Error(`setup/complete failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getProjects(): Promise<{ items: Array<{ id: string; name: string; createdAt: string }> }> {
    const res = await this.request.get('/api/projects', { headers: this.headers() });
    if (!res.ok()) throw new Error(`get projects failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async createProvider(opts: {
    name: string;
    endpoint: string;
    upstreamApiKey: string;
    kind: string;
  }): Promise<{ id: string }> {
    const res = await this.request.post('/api/providers', {
      headers: this.headers(),
      data: opts,
    });
    if (!res.ok()) throw new Error(`create provider failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async createProviderApiKey(providerId: string, keyName: string, projectId: string): Promise<{ keyValue: string }> {
    const res = await this.request.post(`/api/providers/${providerId}/keys`, {
      headers: this.headers(),
      data: { name: keyName, projectId },
    });
    if (!res.ok()) throw new Error(`create api key failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getAgentCalls(params?: { page?: number; pageSize?: number }): Promise<{ total: number; items: Record<string, unknown>[] }> {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request.get(`/api/agent-calls${query}`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`agent-calls failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // CreateEvaluatorRequest is polymorphic on a `kind` discriminator that System.Text.Json
  // requires to be the first property; the base type only needs `projectId`.
  async createEvaluator(projectId: string): Promise<{ id: string }> {
    const res = await this.request.post('/api/evaluators', {
      headers: this.headers(),
      data: { kind: 'ExactMatch', projectId },
    });
    if (!res.ok()) throw new Error(`create evaluator failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // A test suite is tied to an agent and embeds its test cases inline. Each case supplies an
  // input message list and a single expected-output message.
  async createTestSuite(
    name: string,
    agentId: string,
    evaluatorIds: string[],
    cases: Array<{ userContent: string; expectedContent: string }>,
  ): Promise<{ id: string }> {
    const res = await this.request.post('/api/test-suites', {
      headers: this.headers(),
      data: {
        name,
        agentId,
        evaluatorIds,
        testCases: cases.map((c) => ({
          input: [{ role: 'user', content: c.userContent }],
          expectedOutput: { role: 'assistant', content: c.expectedContent },
        })),
      },
    });
    if (!res.ok()) throw new Error(`create suite failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async listAgents(): Promise<{ items: Array<{ id: string; name: string; endpointId: string }> }> {
    const res = await this.request.get('/api/agents', { headers: this.headers() });
    if (!res.ok()) throw new Error(`list agents failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // Runs are started as a test-run group: the suite's agent is executed against one or more
  // model endpoints. Returns the group, whose status we poll.
  async createTestRunGroup(suiteId: string, modelEndpointIds: string[]): Promise<{ id: string }> {
    const res = await this.request.post('/api/test-run-groups', {
      headers: this.headers(),
      data: { testSuiteId: suiteId, modelEndpointIds },
    });
    if (!res.ok()) throw new Error(`start run failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getTestRunGroup(id: string): Promise<{ id: string; status: string }> {
    const res = await this.request.get(`/api/test-run-groups/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get run group failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // Proposals. The public ProposalsController exposes GET /api/proposals (list, optional
  // ?agentId / ?projectId filters) and PATCH /api/proposals/{id}/status. There is no public
  // create endpoint, so seeding a proposal goes through the test-only seed action
  // POST /api/proposals/seed (backend stub — throws NotImplementedException until the user
  // implements it). The request shape mirrors the SystemPrompt proposal details DTO.
  async seedProposal(opts: {
    agentId: string;
    kind?: 'SystemPrompt' | 'ModelSwitch' | 'ToolUpdate';
    status?: string;
    priority?: string;
    rationale: string;
    proposedEndpointId?: string;
    proposedTools?: Array<{ name: string; description: string; parametersJson?: string | null }>;
  }): Promise<{ id: string }> {
    const kind = opts.kind ?? 'SystemPrompt';
    // The seed details are a polymorphic ProposalDetailsDto. ModelSwitch/ToolUpdate use distinct
    // *Seed discriminators (ModelSwitchSeed / ToolUpdateSeed) so they don't collide with the
    // response-mapper's discriminators in the same hierarchy.
    let details: Record<string, unknown>;
    if (kind === 'ModelSwitch') {
      details = { kind: 'ModelSwitchSeed', proposedEndpointId: opts.proposedEndpointId };
    } else if (kind === 'ToolUpdate') {
      details = {
        kind: 'ToolUpdateSeed',
        proposedTools: opts.proposedTools ?? [
          { name: 'lookup', description: 'Look up a value', parametersJson: null },
        ],
      };
    } else {
      details = {
        kind: 'SystemPrompt',
        currentSystemMessage: 'You are a helpful assistant.',
        proposedSystemMessage: 'You are a concise, helpful assistant.',
      };
    }
    // The top-level `kind` is the ProposalKind enum, whose tool-change member is `Tool` (the
    // 'ToolUpdate' alias only names the details discriminator `ToolUpdateSeed`). Map it so the
    // enum binds instead of 400-ing on $.kind.
    const requestKind = kind === 'ToolUpdate' ? 'Tool' : kind;
    const res = await this.request.post('/api/proposals/seed', {
      headers: this.headers(),
      data: {
        agentId: opts.agentId,
        kind: requestKind,
        status: opts.status ?? 'Draft',
        priority: opts.priority ?? 'Medium',
        rationale: opts.rationale,
        details,
      },
    });
    if (!res.ok()) throw new Error(`seed proposal failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getProposals(params?: { agentId?: string; projectId?: string }): Promise<
    Array<{ id: string; status: string; rationale: string; agentId: string }>
  > {
    const qs = new URLSearchParams();
    if (params?.agentId) qs.set('agentId', params.agentId);
    if (params?.projectId) qs.set('projectId', params.projectId);
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request.get(`/api/proposals${query}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get proposals failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // The license snapshot served by GET /api/license (AllowAnonymous). `features` is empty on the
  // Free tier; `tier` is the lowercased LicenseTier ('free' | 'enterprise').
  async getLicense(): Promise<{ tier: string; status: string; features: string[] }> {
    const res = await this.request.get('/api/license', { headers: this.headers() });
    if (!res.ok()) throw new Error(`get license failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // Raw GET /api/proposals returning the response so callers can assert on the status code.
  // On the Free tier the controller's [RequiresFeature(OptimizationProposals)] gate replies 402
  // before the action runs — this is the backend half of the free-tier feature gate.
  proposalsResponse(): Promise<APIResponse> {
    return this.request.get('/api/proposals', { headers: this.headers() });
  }

  // ── Optimization theories ────────────────────────────────────────────────
  // POST /api/theories submits an unproven theory; the validator A/B-tests it in the
  // background. Submission itself is synchronous and needs no LLM, so the 202 response and the
  // returned status (Proposed) are deterministic. `details` is the polymorphic ProposalDetailsDto;
  // a SystemPrompt theory is the only kind that needs no extra ids.
  theorySubmitResponse(opts: {
    agentId: string;
    suiteId: string;
    proposedSystemMessage: string;
    rationale: string;
    source?: string;
    priority?: string;
  }): Promise<APIResponse> {
    return this.request.post('/api/theories', {
      headers: this.headers(),
      data: {
        agentId: opts.agentId,
        suiteId: opts.suiteId,
        priority: opts.priority ?? 'Medium',
        rationale: opts.rationale,
        source: opts.source ?? 'External',
        details: {
          kind: 'SystemPrompt',
          currentSystemMessage: '',
          proposedSystemMessage: opts.proposedSystemMessage,
        },
      },
    });
  }

  async submitTheory(opts: {
    agentId: string;
    suiteId: string;
    proposedSystemMessage: string;
    rationale: string;
    source?: string;
    priority?: string;
  }): Promise<TheoryDto> {
    const res = await this.theorySubmitResponse(opts);
    if (!res.ok()) throw new Error(`submit theory failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // Test-only: seeds a theory directly in a chosen lifecycle state (POST /api/theories/seed),
  // bypassing the async validation pipeline so board states are deterministic. A Validated seed
  // must carry a `resultingProposalId` (seed a proposal first and pass its id).
  async seedTheory(opts: {
    agentId: string;
    status: 'Proposed' | 'Validating' | 'Validated' | 'Invalidated';
    kind?: 'SystemPrompt' | 'ModelSwitch' | 'ToolUpdate';
    source?: string;
    priority?: string;
    rationale: string;
    proposedSystemMessage?: string;
    proposedEndpointId?: string;
    proposedTools?: Array<{ name: string; description: string; parametersJson?: string | null }>;
    baselinePassRate?: number;
    projectedPassRate?: number;
    pValue?: number;
    resultingProposalId?: string;
  }): Promise<TheoryDto> {
    const kind = opts.kind ?? 'SystemPrompt';
    // Polymorphic ProposalDetailsDto, same *Seed discriminators as seedProposal.
    let details: Record<string, unknown>;
    if (kind === 'ModelSwitch') {
      details = { kind: 'ModelSwitchSeed', proposedEndpointId: opts.proposedEndpointId };
    } else if (kind === 'ToolUpdate') {
      details = {
        kind: 'ToolUpdateSeed',
        proposedTools: opts.proposedTools ?? [
          { name: 'lookup', description: 'Look up a value', parametersJson: null },
        ],
      };
    } else {
      details = {
        kind: 'SystemPrompt',
        currentSystemMessage: '',
        proposedSystemMessage: opts.proposedSystemMessage ?? 'You are a concise, helpful assistant.',
      };
    }
    const res = await this.request.post('/api/theories/seed', {
      headers: this.headers(),
      data: {
        agentId: opts.agentId,
        status: opts.status,
        source: opts.source ?? 'Optimizer',
        priority: opts.priority ?? 'Medium',
        rationale: opts.rationale,
        details,
        baselinePassRate: opts.baselinePassRate ?? null,
        projectedPassRate: opts.projectedPassRate ?? null,
        pValue: opts.pValue ?? null,
        resultingProposalId: opts.resultingProposalId ?? null,
      },
    });
    if (!res.ok()) throw new Error(`seed theory failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getTheories(params?: { agentId?: string; projectId?: string; status?: string }): Promise<TheoryDto[]> {
    const qs = new URLSearchParams();
    if (params?.agentId) qs.set('agentId', params.agentId);
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request.get(`/api/theories${query}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get theories failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getTheory(id: string): Promise<TheoryDto> {
    const res = await this.request.get(`/api/theories/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get theory failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Providers ──────────────────────────────────────────────────────────────
  // /api/providers/overview returns each provider with embedded model endpoints + keys. We
  // flatten it to the {id,name,endpoints[]} shape the specs consume.
  async listProviders(): Promise<
    Array<{ id: string; name: string; endpoints: Array<{ id: string; modelName: string }> }>
  > {
    const overview = await this.getProvidersOverview();
    return overview.providers.map((p) => ({
      id: p.provider.id,
      name: p.provider.name,
      endpoints: p.models,
    }));
  }

  async getProvidersOverview(): Promise<{
    providers: Array<{
      provider: { id: string; name: string };
      models: Array<{ id: string; modelName: string }>;
      keys: Array<{ id: string; name: string; keyValue: string }>;
    }>;
    projects: Array<{ id: string; name: string; systemEndpointId: string }>;
  }> {
    const res = await this.request.get('/api/providers/overview', { headers: this.headers() });
    if (!res.ok()) throw new Error(`providers overview failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async addModelToProvider(providerId: string, modelName: string): Promise<{ id: string; modelName: string }> {
    const res = await this.request.post(`/api/providers/${providerId}/models`, {
      headers: this.headers(),
      data: { modelName, inputTokenCost: null, outputTokenCost: null },
    });
    if (!res.ok()) throw new Error(`add model failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async revokeApiKey(providerId: string, keyId: string): Promise<void> {
    const res = await this.request.delete(`/api/providers/${providerId}/keys/${keyId}`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`revoke key failed: ${res.status()} ${await res.text()}`);
  }

  async deleteProvider(providerId: string): Promise<void> {
    const res = await this.request.delete(`/api/providers/${providerId}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`delete provider failed: ${res.status()} ${await res.text()}`);
  }

  /** First model endpoint id created during setup — the default endpoint specs attach to. */
  async firstEndpointId(): Promise<string> {
    const providers = await this.listProviders();
    const endpoint = providers.flatMap((p) => p.endpoints)[0];
    if (!endpoint) throw new Error('no model endpoint found — setup may not have completed');
    return endpoint.id;
  }

  /** First project id — the tenant's default project created during setup. */
  async firstProjectId(): Promise<string> {
    const { items } = await this.getProjects();
    if (items.length === 0) throw new Error('no project found — setup may not have completed');
    // The "first" project is the oldest/primary one: the server resolves seeds against it
    // (FindFirstAsync, ordered by CreatedAt) and the UI defaults to it. The projects list is
    // sorted newest-first, so pick the minimum CreatedAt rather than items[0].
    return items.reduce((acc, p) => (p.createdAt < acc.createdAt ? p : acc), items[0]).id;
  }

  // ── Agents ─────────────────────────────────────────────────────────────────
  // There is no public POST /api/agents (agents normally appear via proxy ingestion). The
  // test-only POST /api/agents/seed mirrors the proposals/seed pattern so no-LLM specs can
  // create an agent against an existing model endpoint without a real call.
  async createAgent(opts: {
    name: string;
    endpointId: string;
    systemMessage?: string;
    projectId?: string;
  }): Promise<{ id: string; name: string; endpointId: string }> {
    const res = await this.request.post('/api/agents/seed', {
      headers: this.headers(),
      data: {
        // The agent-version fingerprint is derived from (systemMessage + tools) and is unique per
        // project. Seeding two agents with an identical default prompt would collide on
        // IX_AgentVersionEntity_Project_Fingerprint and 500. Make the default unique per call so
        // each seeded agent is its own distinct version.
        name: opts.name,
        systemMessage:
          opts.systemMessage ??
          `You are a helpful assistant. [${Date.now()}-${Math.random().toString(36).slice(2)}]`,
        endpointId: opts.endpointId,
        projectId: opts.projectId ?? null,
      },
    });
    if (!res.ok()) throw new Error(`create agent failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getAgent(id: string): Promise<{
    id: string;
    name: string;
    systemMessage: string;
    endpointId: string;
    tools: Array<{ name: string }>;
  }> {
    const res = await this.request.get(`/api/agents/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get agent failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async deleteAgent(id: string): Promise<void> {
    const res = await this.request.delete(`/api/agents/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`delete agent failed: ${res.status()} ${await res.text()}`);
  }

  async getAgentVersions(
    agentId: string,
  ): Promise<Array<{ id: string; versionNumber: number; systemMessage: string }>> {
    const res = await this.request.get(`/api/agents/${agentId}/versions`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get agent versions failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async updateAgentEndpoint(agentId: string, endpointId: string): Promise<void> {
    const res = await this.request.patch(`/api/agents/${agentId}/endpoint`, {
      headers: this.headers(),
      data: { endpointId },
    });
    if (!res.ok()) throw new Error(`update agent endpoint failed: ${res.status()} ${await res.text()}`);
  }

  // ── Traces / AgentCalls ────────────────────────────────────────────────────
  // No public endpoint creates an AgentCall (ingestion is the real path). The test-only
  // POST /api/agent-calls/seed builds a captured call directly so no-LLM trace/dashboard specs
  // have data to assert on.
  async seedAgentCall(opts: {
    agentId: string;
    model?: string;
    userContent: string;
    assistantContent: string;
    systemContent?: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    conversationId?: string;
  }): Promise<{ id: string; agentId: string | null }> {
    const res = await this.request.post('/api/agent-calls/seed', {
      headers: this.headers(),
      data: {
        agentId: opts.agentId,
        model: opts.model ?? 'gpt-4o-mini',
        userContent: opts.userContent,
        assistantContent: opts.assistantContent,
        systemContent: opts.systemContent ?? 'You are a helpful assistant.',
        inputTokens: opts.inputTokens ?? 10,
        outputTokens: opts.outputTokens ?? 5,
        durationMs: opts.durationMs ?? 100,
        conversationId: opts.conversationId ?? null,
      },
    });
    if (!res.ok()) throw new Error(`seed agent-call failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Test suites / cases ────────────────────────────────────────────────────
  async getTestSuite(id: string): Promise<{
    id: string;
    name: string;
    evaluators: Array<{ id: string; kind: string }>;
    testCases: Array<{ id: string }>;
  }> {
    const res = await this.request.get(`/api/test-suites/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get suite failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async createSuiteFromTraces(
    name: string,
    agentId: string,
    agentCallIds: string[],
    evaluatorIds: string[] = [],
  ): Promise<{ id: string }> {
    const res = await this.request.post('/api/test-suites/from-traces', {
      headers: this.headers(),
      data: { name, agentId, agentCallIds, evaluatorIds },
    });
    if (!res.ok()) throw new Error(`create suite from traces failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // Add a test case to an existing suite: either promote an agent call (fromAgentCallId) or
  // supply inline messages. Returns the full updated suite.
  async createTestCase(
    suiteId: string,
    opts: { fromAgentCallId?: string; userContent?: string; expectedContent?: string },
  ): Promise<{ id: string; testCases: Array<{ id: string }> }> {
    const data = opts.fromAgentCallId
      ? { fromAgentCallId: opts.fromAgentCallId }
      : {
          input: [{ role: 'user', content: opts.userContent }],
          expectedOutput: { role: 'assistant', content: opts.expectedContent },
        };
    const res = await this.request.post(`/api/test-suites/${suiteId}/test-cases`, {
      headers: this.headers(),
      data,
    });
    if (!res.ok()) throw new Error(`add test case failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // PUT /api/test-suites/{id} replaces the evaluator set (send the full desired list). The
  // backend ignores `name`, so there is no rename via this endpoint.
  async updateSuiteEvaluators(
    suiteId: string,
    evaluatorIds: string[],
  ): Promise<{ id: string; evaluators: Array<{ id: string }> }> {
    const res = await this.request.put(`/api/test-suites/${suiteId}`, {
      headers: this.headers(),
      data: { evaluatorIds },
    });
    if (!res.ok()) throw new Error(`update suite failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async deleteSuite(suiteId: string): Promise<void> {
    const res = await this.request.delete(`/api/test-suites/${suiteId}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`delete suite failed: ${res.status()} ${await res.text()}`);
  }

  // ── Evaluators ─────────────────────────────────────────────────────────────
  // Polymorphic CreateEvaluatorRequest: `kind` discriminator must be the first property. Valid
  // kinds: ExactMatch | NumericMatch | JsonSchemaMatch | Agentic. (No ToolUsage create endpoint.)
  async createEvaluatorOfKind(
    payload: Record<string, unknown>,
  ): Promise<{ id: string; kind: string; name: string }> {
    const res = await this.request.post('/api/evaluators', { headers: this.headers(), data: payload });
    if (!res.ok()) throw new Error(`create evaluator failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getEvaluator(id: string): Promise<{
    id: string;
    kind: string;
    name: string;
    jsonSchema: string | null;
    extractionPattern: string | null;
    tolerance: number | null;
  }> {
    const res = await this.request.get(`/api/evaluators/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get evaluator failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async updateEvaluator(id: string, payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.request.put(`/api/evaluators/${id}`, { headers: this.headers(), data: payload });
    if (!res.ok()) throw new Error(`update evaluator failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async deleteEvaluator(id: string): Promise<void> {
    const res = await this.request.delete(`/api/evaluators/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`delete evaluator failed: ${res.status()} ${await res.text()}`);
  }

  async runEvaluatorTestBench(
    evaluatorId: string,
    testCaseId: string,
    actualResponseOverride: string | null = null,
  ): Promise<{ evaluatorId: string; kind: string; score: string | null; reasoning: string | null }> {
    const res = await this.request.post(`/api/evaluators/${evaluatorId}/test-bench/run`, {
      headers: this.headers(),
      data: { testCaseId, actualResponseOverride },
    });
    if (!res.ok()) throw new Error(`test bench run failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Statistics / dashboard ─────────────────────────────────────────────────
  async getStatistics(params?: { projectId?: string; from?: string; to?: string }): Promise<{
    summary: {
      totalCalls: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      avgLatencyMs: number;
      overallPassRate: number | null;
    };
    agents: Array<{ id: string }>;
    recentTraces: Array<{ id: string }>;
  }> {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request.get(`/api/statistics/dashboard${query}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`statistics failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Search (project-scoped) ────────────────────────────────────────────────
  async search(projectId: string, q: string): Promise<{ hits: Array<{ kind: string; entityId: string; title: string }> }> {
    const res = await this.request.get(`/api/projects/${projectId}/search?q=${encodeURIComponent(q)}`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`search failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async reindexSearch(projectId: string): Promise<void> {
    const res = await this.request.post(`/api/projects/${projectId}/search/reindex`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`reindex failed: ${res.status()} ${await res.text()}`);
  }

  async getSearchStatus(
    projectId: string,
  ): Promise<{ lastIndexedAt: string | null; documentCount: number; isReindexing: boolean }> {
    const res = await this.request.get(`/api/projects/${projectId}/search/status`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`search status failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Projects / members / users ─────────────────────────────────────────────
  async createProject(name: string, systemEndpointId: string, memberIds: string[] = []): Promise<{ id: string; name: string }> {
    const res = await this.request.post('/api/projects', {
      headers: this.headers(),
      data: { name, systemEndpointId, memberIds },
    });
    if (!res.ok()) throw new Error(`create project failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async deleteProject(id: string): Promise<void> {
    const res = await this.request.delete(`/api/projects/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`delete project failed: ${res.status()} ${await res.text()}`);
  }

  async addProjectMember(projectId: string, userId: string): Promise<void> {
    const res = await this.request.post(`/api/projects/${projectId}/members/${userId}`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`add member failed: ${res.status()} ${await res.text()}`);
  }

  async listUsers(): Promise<{ items: Array<{ id: string; email: string; role: string; isExternal: boolean }> }> {
    const res = await this.request.get('/api/users', { headers: this.headers() });
    if (!res.ok()) throw new Error(`list users failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async updateUserRole(
    id: string,
    role: 'Member' | 'Admin',
  ): Promise<{ id: string; email: string; role: string }> {
    const res = await this.request.put(`/api/users/${id}/role`, {
      headers: this.headers(),
      data: { role },
    });
    if (!res.ok()) throw new Error(`update role failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async deleteUser(id: string): Promise<void> {
    const res = await this.request.delete(`/api/users/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`delete user failed: ${res.status()} ${await res.text()}`);
  }

  async getUserProjects(id: string): Promise<Array<{ id: string; name: string }>> {
    const res = await this.request.get(`/api/users/${id}/projects`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get user projects failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  /** Redeems an invite token by setting a password, creating the local user. Anonymous endpoint. */
  async signup(token: string, password: string): Promise<{ token: string }> {
    const res = await this.request.post('/api/auth/signup', { data: { token, password } });
    if (!res.ok()) throw new Error(`signup failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Invites (admin + local mode) ───────────────────────────────────────────
  async inviteUser(
    email: string,
    role: 'Member' | 'Admin' = 'Member',
  ): Promise<{ token: string; url: string; expiresAt: string }> {
    const res = await this.request.post('/api/auth/invites', {
      headers: this.headers(),
      data: { email, role },
    });
    if (!res.ok()) throw new Error(`invite failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async listInvites(): Promise<Array<{ id: string; email: string; role: string; consumedAt: string | null; url: string }>> {
    const res = await this.request.get('/api/auth/invites', { headers: this.headers() });
    if (!res.ok()) throw new Error(`list invites failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async revokeInvite(id: string): Promise<void> {
    const res = await this.request.delete(`/api/auth/invites/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`revoke invite failed: ${res.status()} ${await res.text()}`);
  }

  // ── Config ─────────────────────────────────────────────────────────────────
  async getConfig(): Promise<{ kiosk: boolean }> {
    const res = await this.request.get('/api/config', { headers: this.headers() });
    if (!res.ok()) throw new Error(`get config failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Model pricing (for cost assertions) ────────────────────────────────────
  async updateModelPricing(
    providerId: string,
    endpointId: string,
    inputTokenCost: number,
    outputTokenCost: number,
  ): Promise<{ id: string; inputTokenCost: number | null; outputTokenCost: number | null }> {
    const res = await this.request.put(`/api/providers/${providerId}/models/${endpointId}`, {
      headers: this.headers(),
      data: { inputTokenCost, outputTokenCost },
    });
    if (!res.ok()) throw new Error(`update model pricing failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getModelEndpoints(): Promise<
    Array<{ id: string; modelName: string; providerId: string; inputTokenCost: number | null; outputTokenCost: number | null }>
  > {
    const res = await this.request.get('/api/model-endpoints', { headers: this.headers() });
    if (!res.ok()) throw new Error(`model endpoints failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Cancel flows ───────────────────────────────────────────────────────────
  async cancelTestRunGroup(id: string): Promise<{ id: string; status: string }> {
    const res = await this.request.post(`/api/test-run-groups/${id}/cancel`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`cancel run group failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async cancelTestRun(id: string): Promise<void> {
    const res = await this.request.post(`/api/test-runs/${id}/cancel`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`cancel run failed: ${res.status()} ${await res.text()}`);
  }

  // ── Search depth ───────────────────────────────────────────────────────────
  async searchRecent(
    projectId: string,
    kinds: string[] = [],
    limit = 6,
  ): Promise<{ hits: Array<{ kind: string; entityId: string; title: string }> }> {
    const params = new URLSearchParams();
    if (kinds.length) params.set('kinds', kinds.join(','));
    params.set('limit', String(limit));
    const res = await this.request.get(`/api/projects/${projectId}/search/recent?${params}`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`search recent failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getSearchSettings(
    projectId: string,
  ): Promise<{ enabled: boolean; indexedKinds: string[]; autoReindexOnChange: boolean; snippetLength: number }> {
    const res = await this.request.get(`/api/projects/${projectId}/search/settings`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`get search settings failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async updateSearchSettings(
    projectId: string,
    settings: { enabled: boolean; indexedKinds: string[]; autoReindexOnChange: boolean; snippetLength: number },
  ): Promise<{ enabled: boolean }> {
    const res = await this.request.put(`/api/projects/${projectId}/search/settings`, {
      headers: this.headers(),
      data: settings,
    });
    if (!res.ok()) throw new Error(`update search settings failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  // ── Paged / filtered list helpers ──────────────────────────────────────────
  async listAgentsPaged(
    params: { page?: number; pageSize?: number; projectId?: string } = {},
  ): Promise<{ total: number; items: Array<{ id: string; name: string; isSystemAgent: boolean }> }> {
    return this.getList('/api/agents', params);
  }

  async listSuites(
    params: { page?: number; pageSize?: number; agentId?: string; projectId?: string } = {},
  ): Promise<{ total: number; items: Array<{ id: string; name: string }> }> {
    return this.getList('/api/test-suites', params);
  }

  async listTestRunGroups(
    params: { page?: number; pageSize?: number; agentId?: string; projectId?: string } = {},
  ): Promise<{ total: number; items: Array<{ id: string; status: string }> }> {
    return this.getList('/api/test-run-groups', params);
  }

  /** Test-only: emit a real Error/Critical backend log that the capture pipeline persists. */
  async logBackendError(message: string, critical = false): Promise<void> {
    const res = await this.request.post('/api/test/log-error', {
      headers: this.headers(),
      data: { message, critical },
    });
    if (!res.ok()) throw new Error(`log-error failed: ${res.status()} ${await res.text()}`);
  }

  async listErrorLog(
    params: { page?: number; pageSize?: number; level?: string } = {},
  ): Promise<{
    total: number;
    items: Array<{
      id: string;
      message: string;
      level: string;
      category: string;
      exceptionType: string | null;
      stackTrace: string | null;
      createdAt: string;
    }>;
  }> {
    return this.getList('/api/error-log', params);
  }

  private async getList<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null) qs.set(k, String(v));
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request.get(`${path}${query}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`list ${path} failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }
}
