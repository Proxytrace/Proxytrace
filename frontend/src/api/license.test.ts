import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The client pulls in browser-ish singletons; stub them so the module loads in node.
vi.mock('../auth/token', () => ({
  getAccessToken: () => null,
  notifyUnauthorized: vi.fn(),
}));

const showToast = vi.fn();
vi.mock('../components/ui/Toast', () => ({
  showToast: (...args: unknown[]) => showToast(...args),
}));

import { api, UpgradeRequiredError } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('client 402 license interceptor', () => {
  beforeEach(() => {
    showToast.mockClear();
    // client.ts reads window.location.href when surfacing a generic error toast.
    vi.stubGlobal('window', { location: { href: 'http://localhost/test' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws UpgradeRequiredError for a 402 FeatureNotLicensed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(402, { error: { message: 'Optimization proposals require Enterprise.', type: 'FeatureNotLicensed' } }),
    ));

    const promise = api.get('/api/proposals');
    await expect(promise).rejects.toBeInstanceOf(UpgradeRequiredError);
    await expect(promise).rejects.toMatchObject({ errorType: 'FeatureNotLicensed', status: 402 });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('throws UpgradeRequiredError for a 402 LicenseLimitExceeded response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(402, { error: { message: 'Project limit reached.', type: 'LicenseLimitExceeded' } }),
    ));

    await expect(api.post('/api/setup')).rejects.toBeInstanceOf(UpgradeRequiredError);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('does NOT throw UpgradeRequiredError for a 402 with an unrelated type (falls through to toast)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(402, { error: { message: 'Payment required.', type: 'SomethingElse' } }),
    ));

    const promise = api.get('/api/foo');
    await expect(promise).rejects.not.toBeInstanceOf(UpgradeRequiredError);
    await expect(promise).rejects.toThrow('Payment required.');
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('fires the generic toast for a non-402 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(500, { error: { message: 'Boom', type: 'ServerError' } }),
    ));

    await expect(api.get('/api/foo')).rejects.toThrow('Boom');
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
