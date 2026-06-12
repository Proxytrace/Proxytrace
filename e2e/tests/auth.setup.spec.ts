import { test as setup, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

const AUTH_FILE = '.auth/storageState.json';
const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

setup('create first admin and persist session', async ({ page, request }) => {
  const api = new ProxytraceApiClient(request);

  const mode = await api.getAuthMode();
  expect(mode.setupRequired, 'expected empty database — run `docker compose down -v` first').toBe(true);

  const { token } = await api.setupAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  expect(token).toBeTruthy();
  api.setToken(token);

  // Complete setup so the main app shell is accessible (without a project the app
  // redirects everything to /setup, making smoke tests fail). When real LLM creds are
  // provided, seed the project's system endpoint with them: ingesting a captured call
  // creates a new agent, which calls the system endpoint to generate the agent's name —
  // a placeholder key would 401 and the trace would be dropped. Non-LLM runs fall back to
  // the placeholder (those tests never invoke the system endpoint).
  const upstreamEndpoint = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const upstreamApiKey = process.env.OPENAI_API_KEY ?? 'sk-e2e-placeholder';
  const providerKind = upstreamEndpoint.includes('api.openai.com') ? 'OpenAi' : 'OpenAiCompatible';
  await api.completeSetup({
    providerName: 'E2E Test Provider',
    providerEndpoint: upstreamEndpoint,
    providerUpstreamApiKey: upstreamApiKey,
    providerKind,
    modelName: model,
    projectName: 'E2E Test Project',
  });

  // Use 'load' not 'networkidle' — SSE connections never reach network idle.
  await page.goto('/', { waitUntil: 'load' });
  // The session is an httpOnly cookie (the SPA never persists the JWT itself) — inject it
  // at the browser-context level, then reload so the app restores the session via /me.
  await page.context().addCookies([{
    name: 'proxytrace_session',
    value: token,
    url: new URL(page.url()).origin,
    httpOnly: true,
    sameSite: 'Strict',
  }]);
  await page.reload({ waitUntil: 'load' });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: AUTH_FILE });
});
