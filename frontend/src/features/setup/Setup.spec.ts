import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupApi } from '../../api/setup';
import { ModelProviderKind } from '../../api/models';
import type { LicenseDto } from '../../api/license';
import { buildTierSummary, presetById, PROVIDER_PRESETS } from './setupMeta';
import { buildQuickStartSnippets } from './snippets';

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  });
}

describe('setupApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns isConfigured: false when no users exist', async () => {
      vi.stubGlobal('fetch', mockFetch({ isConfigured: false }));
      const result = await setupApi.getStatus();
      expect(result.isConfigured).toBe(false);
    });

    it('returns isConfigured: true after setup completes', async () => {
      vi.stubGlobal('fetch', mockFetch({ isConfigured: true }));
      const result = await setupApi.getStatus();
      expect(result.isConfigured).toBe(true);
    });

    it('calls GET /api/setup/status', async () => {
      const fetch = mockFetch({ isConfigured: false });
      vi.stubGlobal('fetch', fetch);
      await setupApi.getStatus();
      expect(fetch).toHaveBeenCalledWith('/api/setup/status', expect.objectContaining({}));
    });
  });

  describe('complete', () => {
    it('posts the full setup payload to /api/setup/complete', async () => {
      const response = {
        providerId: 'p1',
        endpointId: 'e1',
        projectId: 'pr1',
      };
      const fetch = mockFetch(response);
      vi.stubGlobal('fetch', fetch);

      const req = {
        providerName: 'OpenAI',
        providerEndpoint: 'https://api.openai.com/v1',
        providerUpstreamApiKey: 'sk-x',
        providerKind: ModelProviderKind.OpenAi,
        modelName: 'gpt-4o',
        projectName: 'My App',
      };
      const result = await setupApi.complete(req);

      expect(result.projectId).toBe('pr1');
      expect(fetch).toHaveBeenCalledWith(
        '/api/setup/complete',
        expect.objectContaining({ method: 'POST', body: JSON.stringify(req) }),
      );
    });
  });
});

describe('buildQuickStartSnippets', () => {
  const baseUrl = 'https://host/my-project/openai/v1';
  const snippets = buildQuickStartSnippets(baseUrl, 'gpt-4o-mini');

  it('covers Python, TypeScript, C# and curl', () => {
    expect(snippets.map(s => s.id)).toEqual(['python', 'typescript', 'csharp', 'curl']);
  });

  it('embeds the project-scoped proxy endpoint in every snippet', () => {
    for (const snippet of snippets) {
      expect(snippet.code).toContain(baseUrl);
    }
  });

  it('embeds the chosen model in every snippet', () => {
    for (const snippet of snippets) {
      expect(snippet.code).toContain('gpt-4o-mini');
    }
  });

  it('never embeds an API key value — snippets reference the env var instead', () => {
    for (const snippet of snippets) {
      expect(snippet.code).toContain('OPENAI_API_KEY');
      expect(snippet.code).not.toMatch(/sk-[a-zA-Z0-9]/);
    }
  });
});

describe('provider presets', () => {
  it('every preset uses an OpenAI or OpenAI-compatible kind', () => {
    for (const preset of PROVIDER_PRESETS) {
      expect([ModelProviderKind.OpenAi, ModelProviderKind.OpenAiCompatible]).toContain(preset.kind);
    }
  });

  it('only OpenAI uses the native kind', () => {
    expect(presetById('openai').kind).toBe(ModelProviderKind.OpenAi);
    expect(presetById('anthropic').kind).toBe(ModelProviderKind.OpenAiCompatible);
    expect(presetById('xai').kind).toBe(ModelProviderKind.OpenAiCompatible);
    expect(presetById('azure-foundry').kind).toBe(ModelProviderKind.OpenAiCompatible);
    expect(presetById('custom').kind).toBe(ModelProviderKind.OpenAiCompatible);
  });

  it('presets with a fixed endpoint prefill it; templated ones stay empty', () => {
    expect(presetById('openai').endpoint).toBe('https://api.openai.com/v1');
    expect(presetById('anthropic').endpoint).toBe('https://api.anthropic.com/v1');
    expect(presetById('xai').endpoint).toBe('https://api.x.ai/v1');
    expect(presetById('azure-foundry').endpoint).toBe('');
    expect(presetById('custom').endpoint).toBe('');
  });
});

describe('buildTierSummary', () => {
  const freeLicense: LicenseDto = {
    tier: 'free',
    status: 'free',
    expiresAt: null,
    gracePeriodEndsAt: null,
    customerEmail: null,
    features: [],
    limits: { MaxProjects: 1, MaxAgents: 1, MaxTestSuites: 1, MaxTracesPerMonth: 10000, TraceRetentionDays: 14 },
  };

  const enterpriseLicense: LicenseDto = {
    ...freeLicense,
    tier: 'enterprise',
    status: 'active',
    features: ['OptimizationProposals', 'AgenticEvaluators', 'CustomEvaluators', 'SsoOidc', 'AuditLog'],
    limits: { TraceRetentionDays: 365 },
  };

  it('free tier lists limits and locks all enterprise features', () => {
    const summary = buildTierSummary(freeLicense);
    expect(summary.isFree).toBe(true);
    expect(summary.tierLabel).toBe('Free');
    expect(summary.included.join(' ')).toContain('1 project');
    expect(summary.included.join(' ')).toContain('traces per month');
    expect(summary.locked).toContain('Optimization proposals');
    expect(summary.locked).toContain('SSO / OIDC sign-in');
    expect(summary.locked).toHaveLength(5);
  });

  it('enterprise tier includes granted features and locks nothing', () => {
    const summary = buildTierSummary(enterpriseLicense);
    expect(summary.isFree).toBe(false);
    expect(summary.tierLabel).toBe('Enterprise');
    expect(summary.included).toContain('Optimization proposals');
    expect(summary.included).toContain('Unlimited projects, agents & test suites');
    expect(summary.locked).toHaveLength(0);
  });

  it('treats an undefined license as Free', () => {
    const summary = buildTierSummary(undefined);
    expect(summary.isFree).toBe(true);
    expect(summary.locked).toHaveLength(5);
  });
});
