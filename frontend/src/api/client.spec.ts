import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getAccessToken, notifyUnauthorized, showToast } = vi.hoisted(() => ({
  getAccessToken: vi.fn(() => undefined as string | undefined),
  notifyUnauthorized: vi.fn(),
  showToast: vi.fn(),
}));
vi.mock('../auth/token', () => ({ getAccessToken, notifyUnauthorized }));
vi.mock('../components/ui/Toast', () => ({ showToast }));

import { api } from './client';

/** A minimal ok JSON Response stand-in. */
const okJson = (body: unknown = { ok: true }) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(okJson());
  vi.stubGlobal('fetch', fetchMock);
  // The error path reads window.location.href; stub it so the spec runs regardless of test env.
  vi.stubGlobal('window', { location: { href: 'http://test/' } });
});

afterEach(() => vi.unstubAllGlobals());

/** The RequestInit fetch was called with on the last invocation. */
const lastInit = (): RequestInit => fetchMock.mock.calls.at(-1)?.[1] as RequestInit;

describe('api request — opts.signal forwarding', () => {
  it('forwards opts.signal to fetch on every verb', async () => {
    const signal = new AbortController().signal;
    await api.get('/x', { signal });
    expect(lastInit().signal).toBe(signal);

    await api.post('/x', { a: 1 }, { signal });
    expect(lastInit().signal).toBe(signal);

    await api.put('/x', { a: 1 }, { signal });
    expect(lastInit().signal).toBe(signal);

    await api.patch('/x', { a: 1 }, { signal });
    expect(lastInit().signal).toBe(signal);

    await api.del('/x', { signal });
    expect(lastInit().signal).toBe(signal);
  });

  it('leaves signal undefined when no opts are passed', async () => {
    await api.get('/x');
    expect(lastInit().signal).toBeUndefined();
  });

  it('serializes the body and sets the method per verb', async () => {
    await api.post('/x', { a: 1 });
    expect(lastInit().method).toBe('POST');
    expect(lastInit().body).toBe(JSON.stringify({ a: 1 }));

    await api.del('/x');
    expect(lastInit().method).toBe('DELETE');
  });
});

describe('api request — silentStatuses', () => {
  const errorRes = (status: number) =>
    ({ ok: false, status, statusText: 'err', json: async () => ({}) }) as unknown as Response;

  it('still rejects on a silenced status but does NOT raise the error toast', async () => {
    fetchMock.mockResolvedValue(errorRes(404));
    await expect(api.get('/missing', { silentStatuses: [404] })).rejects.toMatchObject({ status: 404 });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('raises the error toast for a non-silenced status', async () => {
    fetchMock.mockResolvedValue(errorRes(500));
    await expect(api.get('/boom')).rejects.toBeInstanceOf(Error);
    expect(showToast).toHaveBeenCalledOnce();
  });
});
