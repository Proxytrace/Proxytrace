import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Evaluators feature (/evaluators). The create flow is UI-driven:
//   NewEvaluatorModal → KindPickerCard (evaluator-kind-${kind}) → EvaluatorForm → submit.
// On a successful create the page selects the new evaluator via /evaluators?id=${id}, so we read
// the new id back from the URL. The legacy /evaluators/${id} path form still works (it redirects
// to the query form), so both shapes are accepted. Data the UI can't easily set up (attached
// suites) is seeded via the API.
//
// NOTE: the API supports only four evaluator kinds — ExactMatch, NumericMatch, JsonSchemaMatch
// and Agentic. There is no ToolUsage create path, so no ToolUsage test exists here.

const EVALUATOR_ID_RE = /\/evaluators(?:\/|\?id=)([0-9a-f-]{36})/i;

/** Reads the evaluator id the page navigated to after a successful create. */
async function evaluatorIdFromUrl(url: string): Promise<string> {
  const m = url.match(EVALUATOR_ID_RE);
  if (!m) throw new Error(`no evaluator id in url: ${url}`);
  return m[1];
}

test.describe('Evaluators', () => {
  let api: ProxytraceApiClient;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    projectId = await api.firstProjectId();
  });

  test('creates an ExactMatch evaluator via the UI; detail shows its definition', async ({ page }) => {
    await page.goto('/evaluators', { waitUntil: 'load' });
    await expect(page.getByTestId('evaluator-rail')).toBeVisible();

    await page.getByTestId('evaluator-create-btn').click();
    await expect(page.getByTestId('evaluator-new-modal')).toBeVisible();

    await page.getByTestId('evaluator-kind-ExactMatch').click();
    await page.getByTestId('evaluator-form-submit').click();

    // Success navigates to the new evaluator's detail route.
    await expect(page).toHaveURL(EVALUATOR_ID_RE);
    const id = await evaluatorIdFromUrl(page.url());

    await expect(page.getByTestId('evaluator-detail')).toBeVisible();
    await expect(page.getByTestId(`evaluator-rail-item-${id}`)).toBeVisible();
    // ExactMatch has no user-defined config — the definition panel renders its preset note.
    await expect(page.getByTestId('evaluator-definition-panel')).toBeVisible();
    await expect(page.getByTestId('evaluator-definition-panel')).toContainText('ExactMatch');
  });

  test('creates a NumericMatch evaluator; definition renders pattern + tolerance', async ({ page }) => {
    await page.goto('/evaluators', { waitUntil: 'load' });

    await page.getByTestId('evaluator-create-btn').click();
    await page.getByTestId('evaluator-kind-NumericMatch').click();

    await page.getByTestId('evaluator-form-extractionpattern').fill('score: (\\d+)');
    await page.getByTestId('evaluator-form-tolerance').fill('0.5');
    await page.getByTestId('evaluator-form-submit').click();

    await expect(page).toHaveURL(EVALUATOR_ID_RE);
    await expect(page.getByTestId('evaluator-detail')).toBeVisible();

    const def = page.getByTestId('evaluator-definition-panel');
    await expect(def).toBeVisible();
    await expect(def).toContainText('score: (\\d+)');
    await expect(def).toContainText('0.5');
  });

  test('creates a JsonSchemaMatch evaluator; schema renders in the numbered code block', async ({ page }) => {
    await page.goto('/evaluators', { waitUntil: 'load' });

    await page.getByTestId('evaluator-create-btn').click();
    await page.getByTestId('evaluator-kind-JsonSchemaMatch').click();

    await page.getByTestId('evaluator-form-jsonschema').fill('{"type":"object"}');
    await page.getByTestId('evaluator-form-submit').click();

    await expect(page).toHaveURL(EVALUATOR_ID_RE);
    await expect(page.getByTestId('evaluator-detail')).toBeVisible();

    // JsonSchemaMatch definitions render the schema in NumberedCode.
    const code = page.getByTestId('evaluator-numbered-code');
    await expect(code).toBeVisible();
    await expect(code).toContainText('"type"');
    await expect(code).toContainText('"object"');
  });

  test("edits a NumericMatch evaluator's config; the change persists", async ({ page }) => {
    const created = await api.createEvaluatorOfKind({
      kind: 'NumericMatch',
      projectId,
      extractionPattern: '\\d+',
      tolerance: 0.5,
    });

    await page.goto(`/evaluators/${created.id}`, { waitUntil: 'load' });
    await expect(page.getByTestId('evaluator-detail')).toBeVisible();

    // The header Edit button opens an inline Modal (portal) carrying the same EvaluatorForm.
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const editModal = page.locator('.modal-panel');
    await expect(editModal).toBeVisible();

    await editModal.getByTestId('evaluator-form-tolerance').fill('2.5');
    await editModal.getByRole('button', { name: 'Save' }).click();

    // Modal closes and the definition panel reflects the new tolerance.
    await expect(editModal).toHaveCount(0);
    await expect(page.getByTestId('evaluator-definition-panel')).toContainText('2.5');

    // Confirm the change persisted server-side.
    await expect.poll(async () => (await api.getEvaluator(created.id)).tolerance).toBe(2.5);
  });

  test('the attached panel lists suites that use the evaluator', async ({ page }) => {
    const stamp = Date.now();
    const endpointId = await api.firstEndpointId();
    const agent = await api.createAgent({ name: `E2E Eval Agent ${stamp}`, endpointId });
    const evaluator = await api.createEvaluatorOfKind({ kind: 'ExactMatch', projectId });
    const suite = await api.createTestSuite(
      `E2E Eval Suite ${stamp}`,
      agent.id,
      [evaluator.id],
      [{ userContent: 'ping', expectedContent: 'pong' }],
    );

    await page.goto(`/evaluators/${evaluator.id}`, { waitUntil: 'load' });
    await expect(page.getByTestId('evaluator-detail')).toBeVisible();

    const attached = page.getByTestId('evaluator-attached-panel');
    await expect(attached).toBeVisible();
    await expect(attached.getByTestId(`evaluator-attached-suite-${suite.id}`)).toBeVisible();
    await expect(attached).toContainText(`E2E Eval Suite ${stamp}`);
  });

  test('deletes an evaluator; its rail item disappears and the empty detail shows', async ({ page }) => {
    // Seed a dedicated evaluator so the deletion is isolated from other tests' data.
    const evaluator = await api.createEvaluatorOfKind({ kind: 'ExactMatch', projectId });

    await page.goto(`/evaluators/${evaluator.id}`, { waitUntil: 'load' });
    await expect(page.getByTestId(`evaluator-rail-item-${evaluator.id}`)).toBeVisible();

    await page.getByTestId(`evaluator-delete-btn-${evaluator.id}`).click();
    // The delete-confirm modal is a portal; scope to it so we don't hit the header trigger.
    await page.locator('.modal-panel').getByRole('button', { name: 'Delete' }).click();

    // The deleted evaluator is gone from the rail.
    await expect(page.getByTestId(`evaluator-rail-item-${evaluator.id}`)).toHaveCount(0);
    // Delete is a soft-delete (archive): the evaluator stays resolvable by id so historical runs
    // keep rendering, but it must be excluded from listings. Assert it's gone from the list rather
    // than expecting a by-id 404.
    await expect.poll(async () => {
      const evaluators = await api.listEvaluators(projectId);
      return evaluators.some((e) => e.id === evaluator.id);
    }).toBe(false);
  });

  test('deep-links straight to an evaluator detail via /evaluators/:id', async ({ page }) => {
    const evaluator = await api.createEvaluatorOfKind({
      kind: 'JsonSchemaMatch',
      projectId,
      jsonSchema: '{"type":"object"}',
    });

    await page.goto(`/evaluators/${evaluator.id}`, { waitUntil: 'load' });

    await expect(page.getByTestId('evaluator-detail')).toBeVisible();
    await expect(page.getByTestId(`evaluator-rail-item-${evaluator.id}`)).toBeVisible();
    await expect(page.getByTestId('evaluator-numbered-code')).toContainText('"object"');
  });
});
