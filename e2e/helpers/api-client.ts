import type { APIRequestContext } from '@playwright/test';

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

  async getProjects(): Promise<{ items: Array<{ id: string; name: string }> }> {
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
    kind?: string;
    status?: string;
    priority?: string;
    rationale: string;
  }): Promise<{ id: string }> {
    const res = await this.request.post('/api/proposals/seed', {
      headers: this.headers(),
      data: {
        agentId: opts.agentId,
        kind: opts.kind ?? 'SystemPrompt',
        status: opts.status ?? 'Draft',
        priority: opts.priority ?? 'Medium',
        rationale: opts.rationale,
        details: {
          kind: 'SystemPrompt',
          currentSystemMessage: 'You are a helpful assistant.',
          proposedSystemMessage: 'You are a concise, helpful assistant.',
        },
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
}
