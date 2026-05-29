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

  async getAgentCalls(params?: { page?: number; pageSize?: number }): Promise<{ total: number; items: unknown[] }> {
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

  async createEvaluator(name: string): Promise<{ id: string }> {
    const res = await this.request.post('/api/evaluators', {
      headers: this.headers(),
      data: {
        name,
        kind: 'ExactMatch',
        caseSensitive: false,
      },
    });
    if (!res.ok()) throw new Error(`create evaluator failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async createTestSuite(name: string, evaluatorIds: string[]): Promise<{ id: string }> {
    const res = await this.request.post('/api/test-suites', {
      headers: this.headers(),
      data: { name, evaluatorIds },
    });
    if (!res.ok()) throw new Error(`create suite failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async createTestCase(suiteId: string, input: string, expectedOutput: string): Promise<{ id: string }> {
    const res = await this.request.post(`/api/test-suites/${suiteId}/cases`, {
      headers: this.headers(),
      data: { input, expectedOutput },
    });
    if (!res.ok()) throw new Error(`create case failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async listAgents(): Promise<{ items: Array<{ id: string; name: string }> }> {
    const res = await this.request.get('/api/agents', { headers: this.headers() });
    if (!res.ok()) throw new Error(`list agents failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async startTestRun(suiteId: string, agentId: string): Promise<{ id: string }> {
    const res = await this.request.post('/api/test-runs', {
      headers: this.headers(),
      data: { testSuiteId: suiteId, agentId },
    });
    if (!res.ok()) throw new Error(`start run failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async getTestRun(id: string): Promise<{ id: string; status: string }> {
    const res = await this.request.get(`/api/test-runs/${id}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`get run failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }
}
