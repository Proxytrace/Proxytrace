import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// The Providers page (/providers) lists upstream model providers in a left rail (ProviderList),
// and renders the selected provider's detail on the right (ProviderDetail) as stacked sections —
// a Models section above an API-keys section, both always rendered (no tabs). The detail header
// shows the upstream endpoint only when it differs from the kind's canonical default. Setup seeds
// one provider ('E2E Test Provider') with a model and a project, so the tenant is never truly
// empty — the empty-state test is handled defensively below.
//
// Prerequisites (provider/project) are created via the API client in beforeAll so the tests are
// fast and independent. Each test navigates fresh and asserts through stable data-testids.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

// Reads back the id of a named API key under a provider from the overview, asserting it exists.
async function findKeyId(api: ProxytraceApiClient, providerId: string, keyName: string): Promise<string> {
  const overview = await api.getProvidersOverview();
  const provider = overview.providers.find((p) => p.provider.id === providerId);
  const key = provider?.keys.find((k) => k.name === keyName);
  expect(key, `key "${keyName}" should exist under provider ${providerId}`).toBeTruthy();
  if (!key) throw new Error('key not found');
  return key.id;
}

test.describe('Providers page', () => {
  let api: ProxytraceApiClient;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);

    projectId = await api.firstProjectId();
  });

  test('creates a provider via the add modal and shows it in the list', async ({ page }) => {
    const name = `E2E UI Provider ${Date.now()}`;

    await page.goto('/providers', { waitUntil: 'load' });
    await expect(page.getByTestId('provider-list')).toBeVisible();

    await page.getByTestId('provider-create-btn').click();

    await page.getByTestId('provider-field-name').fill(name);
    await page.getByTestId('provider-field-endpoint').fill('https://api.openai.com/v1');
    await page.getByTestId('provider-field-upstreamApiKey').fill('sk-e2e-fake-key');

    // The add modal's submit button is the primary footer action. Scope to the modal's submit
    // testid — the page header also has an "Add provider" button, so a name match is ambiguous.
    await page.getByTestId('modal-panel').getByTestId('modal-submit').click();

    // The new provider is auto-selected; its name appears in both the list and the detail header.
    await expect(page.getByTestId('provider-detail-header')).toBeVisible();
    await expect(page.getByTestId('provider-detail-name')).toHaveText(name);

    // Read back the id so we can target the freshly created row deterministically.
    const overview = await api.getProvidersOverview();
    const created = overview.providers.find((p) => p.provider.name === name);
    expect(created, 'created provider should be present in overview').toBeTruthy();
    if (!created) throw new Error('created provider not found');
    await expect(page.getByTestId(`provider-row-${created.provider.id}`)).toBeVisible();
  });

  test('detail header shows the provider name and lists its seeded model', async ({ page }) => {
    // Seed an isolated provider with a known model via the API so the detail is deterministic.
    const name = `E2E Header Provider ${Date.now()}`;
    const { id } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });
    const model = await api.addModelToProvider(id, 'gpt-4o-mini');

    await page.goto('/providers', { waitUntil: 'load' });
    await page.getByTestId(`provider-row-${id}`).click();

    await expect(page.getByTestId('provider-detail-header')).toBeVisible();
    await expect(page.getByTestId('provider-detail-name')).toHaveText(name);
    // The Models section is always rendered (no tabs); the seeded model row is visible directly.
    await expect(page.getByTestId(`model-row-${model.id}`)).toBeVisible();
  });

  test('lists a provider\'s models in the Models section', async ({ page }) => {
    // Models are pulled from the provider (discovery / reload / background refresh); there is no
    // manual "add model" control in the UI. Seed a model via the API and verify the read-only
    // Models list renders it.
    const name = `E2E Model Provider ${Date.now()}`;
    const { id } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });
    const modelName = `e2e-model-${Date.now()}`;
    const model = await api.addModelToProvider(id, modelName);

    await page.goto('/providers', { waitUntil: 'load' });
    await page.getByTestId(`provider-row-${id}`).click();
    await expect(page.getByTestId('provider-detail-header')).toBeVisible();

    await expect(page.getByTestId(`model-row-${model.id}`)).toBeVisible();
    await expect(page.getByText(modelName)).toBeVisible();
  });

  test('issues an API key, reveals it once, and lists it in the Keys section', async ({ page }) => {
    const name = `E2E Key Provider ${Date.now()}`;
    const { id } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });
    const keyName = `e2e-key-${Date.now()}`;

    await page.goto('/providers', { waitUntil: 'load' });
    await page.getByTestId(`provider-row-${id}`).click();
    await expect(page.getByTestId('provider-detail-header')).toBeVisible();

    // The API-keys section is always rendered below Models (no tabs); the create control is direct.
    await page.getByTestId('key-create-btn').click();

    await page.getByTestId('key-name-input').fill(keyName);
    // The project select defaults to the tenant's project; submit generates the key.
    await page.getByTestId('key-create-submit').click();

    // The just-created key's value is shown once in a one-time reveal banner.
    await expect(page.getByTestId('key-value-reveal')).toBeVisible();
    await expect(page.getByTestId('key-value-reveal')).not.toBeEmpty();

    // And the key is listed in the table. Read the id back to target its row deterministically.
    const keyId = await findKeyId(api, id, keyName);
    await expect(page.getByTestId(`key-row-${keyId}`)).toBeVisible();
  });

  test('revokes an API key and removes it from the Keys section', async ({ page }) => {
    const name = `E2E Revoke Provider ${Date.now()}`;
    const { id } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });
    const keyName = `e2e-revoke-key-${Date.now()}`;
    await api.createProviderApiKey(id, keyName, projectId);
    const keyId = await findKeyId(api, id, keyName);

    await page.goto('/providers', { waitUntil: 'load' });
    await page.getByTestId(`provider-row-${id}`).click();
    await expect(page.getByTestId('provider-detail-header')).toBeVisible();

    // The API-keys section is always rendered (no tabs); the seeded key row is visible directly.
    await expect(page.getByTestId(`key-row-${keyId}`)).toBeVisible();

    // The per-row delete trigger opens a confirm dialog that requires typing the key name.
    await page.getByTestId(`key-delete-btn-${keyId}`).click();
    await page.getByPlaceholder(keyName).fill(keyName);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByTestId(`key-row-${keyId}`)).toHaveCount(0);
  });

  test('deletes a provider and removes its row from the list', async ({ page }) => {
    const name = `E2E Delete Provider ${Date.now()}`;
    const { id } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });

    await page.goto('/providers', { waitUntil: 'load' });
    await page.getByTestId(`provider-row-${id}`).click();
    await expect(page.getByTestId('provider-detail-name')).toHaveText(name);

    // The delete trigger lives in the detail header and opens a name-confirm dialog.
    await page.getByTestId(`provider-delete-btn-${id}`).click();
    await page.getByPlaceholder(name).fill(name);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // The row disappears from the list and selection falls back to another provider, so the
    // detail header no longer shows the deleted provider's name.
    await expect(page.getByTestId(`provider-row-${id}`)).toHaveCount(0);
    await expect(page.getByTestId('provider-detail-name')).not.toHaveText(name);
    await expect(page.getByTestId('provider-list')).toBeVisible();
  });

  test('detail panel has no tabs — Models and Keys sections are stacked', async ({ page }) => {
    // The detail panel was refactored from tabs to always-rendered stacked sections. Assert the
    // tab affordances are gone: no role=tab elements and neither tab testid is present.
    const name = `E2E NoTabs Provider ${Date.now()}`;
    const { id } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });

    await page.goto('/providers', { waitUntil: 'load' });
    await page.getByTestId(`provider-row-${id}`).click();
    await expect(page.getByTestId('provider-detail-header')).toBeVisible();

    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByTestId('models-tab')).toHaveCount(0);
    await expect(page.getByTestId('keys-tab')).toHaveCount(0);

    // Both sections' primary controls are reachable without any tab interaction.
    await expect(page.getByTestId('model-add-btn')).toBeVisible();
    await expect(page.getByTestId('key-create-btn')).toBeVisible();
  });

  test('hides the upstream endpoint when it matches the kind default, shows it when custom', async ({ page }) => {
    // A provider on the canonical OpenAI endpoint hides the endpoint in its header; a provider on
    // a custom endpoint shows it. The endpoint host is the only differentiator here.
    const defaultName = `E2E Default Endpoint ${Date.now()}`;
    const { id: defaultId } = await api.createProvider({
      name: defaultName,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });
    const customEndpoint = 'https://my-proxy.example.com/v1';
    const customName = `E2E Custom Endpoint ${Date.now()}`;
    const { id: customId } = await api.createProvider({
      name: customName,
      endpoint: customEndpoint,
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAiCompatible',
    });

    await page.goto('/providers', { waitUntil: 'load' });

    // Canonical OpenAI endpoint: hidden in the header.
    await page.getByTestId(`provider-row-${defaultId}`).click();
    await expect(page.getByTestId('provider-detail-name')).toHaveText(defaultName);
    await expect(page.getByTestId('provider-detail-header')).not.toContainText('https://api.openai.com/v1');

    // Custom endpoint: shown verbatim in the header.
    await page.getByTestId(`provider-row-${customId}`).click();
    await expect(page.getByTestId('provider-detail-name')).toHaveText(customName);
    await expect(page.getByTestId('provider-detail-header')).toContainText(customEndpoint);
  });

  test('renders the providers empty state when no providers exist', async ({ page }) => {
    // The shared tenant always has at least the setup provider, so a true empty state is not
    // reachable here without deleting every provider (which would break other parallel tests).
    // We assert defensively: only when the API reports zero providers do we expect the empty
    // state in the DOM; otherwise the scenario is skipped.
    const overview = await api.getProvidersOverview();
    test.skip(overview.providers.length > 0, 'tenant has providers; empty state not reachable');

    await page.goto('/providers', { waitUntil: 'load' });
    await expect(page.getByTestId('provider-empty-state')).toBeVisible();
    await expect(page.getByText('No providers yet')).toBeVisible();
  });
});
