import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Negative API paths — exact status codes verified against the controllers:
//
//   • Duplicate model on a provider → 409. ModelProvidersController.CreateModel returns
//     Conflict($"A model endpoint for '{modelName}' already exists for this provider.") when an
//     endpoint with the same model name already exists under that provider.
//   • Invalid evaluator payload → 400. CreateNumericMatchEvaluatorRequest.ExtractionPattern is a
//     `required string` (System.Text.Json polymorphic DTO), so omitting it fails model binding /
//     validation before the action runs → 400 ProblemDetails.
//   • Blank required field → 400. CreateProjectRequest.Name carries
//     [Required, StringLength(200, MinimumLength = 1)] → blank name fails model validation → 400.
//   • Unknown id → 404. GET /api/test-suites/{id:guid} → suiteRepository.FindAsync → null →
//     NotFound(). (A well-formed-but-unknown guid hits the route, unlike a garbage path which the
//     SPA fallback would swallow.)
//
// All calls use the raw `request` fixture with an explicit Bearer header. Each error response must
// be JSON (a handled error envelope / ProblemDetails), never an unhandled crash.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';
const RANDOM_GUID = '00000000-0000-0000-0000-0000000000bb';

async function expectJson(res: { headers(): Record<string, string>; text(): Promise<string> }): Promise<unknown> {
  const contentType = res.headers()['content-type'] ?? '';
  expect(contentType, 'error responses must be JSON, not an HTML crash page').toContain('json');
  const text = await res.text();
  return JSON.parse(text);
}

test.describe('Negative API paths', () => {
  let api: ProxytraceApiClient;
  let token: string;
  let projectId: string;
  let endpointId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    ({ token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD));
    api.setToken(token);
    projectId = await api.firstProjectId();
    endpointId = await api.firstEndpointId();
  });

  test('adding the same model twice to a provider returns 409', async ({ request }) => {
    const { id: providerId } = await api.createProvider({
      name: `E2E Dup Model Provider ${Date.now()}`,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });
    const modelName = `e2e-dup-model-${Date.now()}`;

    // First add succeeds (api-client throws on non-2xx, so reaching the next line proves it).
    await api.addModelToProvider(providerId, modelName);

    // Second add of the identical model name → Conflict.
    const res = await request.post(`/api/providers/${providerId}/models`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { modelName, inputTokenCost: null, outputTokenCost: null },
    });

    expect(res.status()).toBe(409);
    await expectJson(res);
  });

  test('an evaluator payload missing a required field returns 400', async ({ request }) => {
    // NumericMatch without the required `extractionPattern` → 400.
    const res = await request.post('/api/evaluators', {
      headers: { Authorization: `Bearer ${token}` },
      data: { kind: 'NumericMatch', projectId, tolerance: 0.01 },
    });

    expect(res.status()).toBe(400);
    await expectJson(res);
  });

  test('creating a project with a blank name returns 400', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '', systemEndpointId: endpointId, memberIds: [] },
    });

    expect(res.status()).toBe(400);
    const body = await expectJson(res);
    // The ProblemDetails should name the offending Name field.
    expect(JSON.stringify(body).toLowerCase()).toContain('name');
  });

  test('fetching an unknown test suite id returns 404', async ({ request }) => {
    const res = await request.get(`/api/test-suites/${RANDOM_GUID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(404);
    // A 404 from NotFound() may carry an empty body; only assert JSON when a body is present so we
    // still prove the server returned a handled response rather than crashing.
    const text = await res.text();
    if (text.trim().length > 0) {
      expect(() => JSON.parse(text), 'any 404 body must be valid JSON').not.toThrow();
    }
  });
});
