// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestConnectionResponse } from '../../../api/setup';
import { i18n } from '../../../i18n';

const mocks = vi.hoisted(() => ({
  testConnection: vi.fn(),
  listModels: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('../../../api/setup', () => ({
  setupApi: mocks,
}));

import { useSetupWizard } from './useSetupWizard';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof useSetupWizard> | null = null;
let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

function Host() {
  const wizard = useSetupWizard();
  useEffect(() => { latest = wizard; });
  return null;
}

function wizard(): ReturnType<typeof useSetupWizard> {
  if (latest === null) throw new Error('Setup wizard hook has not rendered');
  return latest;
}

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  latest = null;
  queryClient = new QueryClient();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <Host />
        </QueryClientProvider>
      </I18nProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  queryClient.clear();
});

describe('useSetupWizard', () => {
  it('ignores a connection result after the provider credentials change', async () => {
    let resolveRequest: ((response: TestConnectionResponse) => void) | null = null;
    mocks.testConnection.mockImplementation(() => new Promise<TestConnectionResponse>(resolve => {
      resolveRequest = resolve;
    }));
    let pending: Promise<void> | null = null;

    act(() => {
      pending = wizard().handleTestConnection();
    });
    act(() => {
      wizard().setProviderApiKey('wrong-key');
      wizard().clearTestResult();
    });
    await act(async () => {
      if (resolveRequest === null || pending === null) throw new Error('Connection test did not start');
      resolveRequest({
        success: true,
        errorCode: null,
        modelCount: 3,
        error: null,
        errorId: null,
      });
      await pending;
    });

    expect(wizard().testResult).toBeNull();
    expect(wizard().testing).toBe(false);
  });
});
