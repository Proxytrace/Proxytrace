import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupApi } from '../../api/setup';
import { ModelProviderKind } from '../../api/models';

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
        userId: 'u1',
        providerId: 'p1',
        endpointId: 'e1',
        projectId: 'pr1',
        apiKeyValue: 'trsr-abc',
      };
      const fetch = mockFetch(response);
      vi.stubGlobal('fetch', fetch);

      const req = {
        userName: 'Alice',
        providerName: 'Anthropic',
        providerEndpoint: 'https://api.anthropic.com/v1',
        providerUpstreamApiKey: 'sk-x',
        providerKind: ModelProviderKind.Anthropic,
        modelName: 'claude-sonnet-4-5',
        inputTokenCost: 3,
        outputTokenCost: 15,
        projectName: 'My App',
        apiKeyName: 'default',
      };
      const result = await setupApi.complete(req);

      expect(result.apiKeyValue).toBe('trsr-abc');
      expect(fetch).toHaveBeenCalledWith(
        '/api/setup/complete',
        expect.objectContaining({ method: 'POST', body: JSON.stringify(req) }),
      );
    });
  });
});
