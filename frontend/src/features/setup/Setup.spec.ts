import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupApi } from '../../api/setup';

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

  describe('createUser', () => {
    it('posts to /api/users with the given name', async () => {
      const fetch = mockFetch({ id: 'user-1', name: 'Alice' });
      vi.stubGlobal('fetch', fetch);
      const result = await setupApi.createUser('Alice');
      expect(result.id).toBe('user-1');
      expect(fetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Alice' }) }),
      );
    });
  });

  describe('createProject', () => {
    it('posts to /api/projects with name and systemEndpointId', async () => {
      const fetch = mockFetch({ id: 'proj-1', name: 'My App' });
      vi.stubGlobal('fetch', fetch);
      const result = await setupApi.createProject('My App', 'endpoint-1');
      expect(result.id).toBe('proj-1');
      expect(fetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My App', systemEndpointId: 'endpoint-1' }),
        }),
      );
    });
  });
});
