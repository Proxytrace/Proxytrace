import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Negative / error paths: API error shapes (404 / 400) and the UI's graceful degradation when a
// request fails. These run authenticated (shared storageState) so the app shell mounts.
//
// Backend notes (verified against the source):
//   • Proxytrace.Api/Middleware/ExceptionHandlingMiddleware.cs renders a standard envelope
//     `{ error: { message, type, stacktrace } }` for any exception that reaches it. An
//     EntityNotFoundException maps to 404 with type 'EntityNotFoundException'.
//   • Truly-unknown /api/* paths do NOT reach that middleware: Program.cs ends with
//     `MapFallbackToFile("index.html")`, so an unmatched route returns the SPA index.html (200),
//     not a JSON 404. We therefore exercise the standard 404 envelope through a REAL route whose
//     entity is missing — PATCH /api/agents/{guid}/endpoint lets EntityNotFoundException
//     propagate (AgentsController calls repository.GetAsync, which throws).
//   • CreateProjectRequest.Name carries [Required, StringLength(MinimumLength=1)], so a blank
//     name trips ASP.NET model validation → 400 ProblemDetails.
//   • The query client (frontend/src/App.tsx) sets `throwOnError: true`, so a failed page query
//     throws to the per-page <ErrorBoundary>, which renders a friendly "Something went wrong"
//     fallback INSIDE the Shell — the sidebar nav stays visible, never a blank page.
const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

const RANDOM_GUID = '00000000-0000-0000-0000-0000000000aa';

test.describe('Negative & error paths', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    ({ token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD));
  });

  test('a missing entity returns 404 in the standard error envelope', async ({ request }) => {
    // A real route, missing entity → EntityNotFoundException → 404 via the exception middleware.
    const res = await request.patch(`/api/agents/${RANDOM_GUID}/endpoint`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { endpointId: RANDOM_GUID },
    });

    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error, 'standard error envelope must have an `error` object').toBeTruthy();
    expect(body.error.type).toBe('EntityNotFoundException');
    expect(typeof body.error.message).toBe('string');
  });

  test('an invalid create payload is rejected with 400 and validation details', async ({ request }) => {
    const api = new ProxytraceApiClient(request, token);
    const endpointId = await api.firstEndpointId();

    // Valid endpoint but a blank name — the [Required] name attribute fails model validation.
    const res = await request.post('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '', systemEndpointId: endpointId, memberIds: [] },
    });

    expect(res.status()).toBe(400);
    // ASP.NET returns a ProblemDetails whose `errors` map names the offending field.
    const body = await res.json();
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized, 'the 400 body should reference the invalid Name field').toContain('name');
  });

  test('the create-provider form guards a blank submission instead of crashing', async ({ page }) => {
    // UI half of the invalid-payload path: opening the Add-provider modal and leaving fields blank
    // keeps the submit disabled (the form refuses to send an invalid payload) — the page does not
    // crash and the app chrome stays mounted.
    await page.goto('/providers', { waitUntil: 'load' });

    await page.getByTestId('provider-create-btn').click();
    await expect(page.getByTestId('provider-field-name')).toBeVisible();

    // Blank required fields ⇒ submit is disabled. Scope to the modal panel since the page's own
    // "Add provider" create button shares the same accessible name.
    const submit = page.locator('.modal-panel').getByRole('button', { name: 'Add provider' });
    await expect(submit).toBeDisabled();

    // Typing only the name still leaves other required fields blank ⇒ still disabled.
    await page.getByTestId('provider-field-name').fill('Only a name');
    await expect(submit).toBeDisabled();

    // The page is intact: the app shell nav is still visible (no crash / white-screen).
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('a failed list query shows a friendly error state, not a blank page', async ({ page }) => {
    // Force the agents list query to fail. With throwOnError:true the error surfaces in the
    // per-page ErrorBoundary, which renders inside the Shell — nav remains visible.
    await page.route(/\/api\/agents(\?.*)?$/, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/agents', { waitUntil: 'load' });

    // Friendly fallback rendered by components/ErrorBoundary.tsx.
    await expect(page.getByText('Something went wrong')).toBeVisible();
    // The app chrome is still present — the failure is contained, not a blank page.
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
