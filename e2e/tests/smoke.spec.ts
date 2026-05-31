import { test, expect } from '../helpers/fixtures';

// Every main route must load authenticated (storageState from the setup project), render the
// nav chrome, and produce zero JS console / page errors. Adding a route here is the cheapest
// regression guard against a page that white-screens on mount.
const ROUTES = [
  { path: '/', label: 'root' },
  { path: '/dashboard', label: 'dashboard' },
  { path: '/traces', label: 'traces' },
  { path: '/agents', label: 'agents' },
  { path: '/suites', label: 'suites' },
  { path: '/runs', label: 'runs' },
  { path: '/evaluators', label: 'evaluators' },
  { path: '/playground', label: 'playground' },
  { path: '/evaluator-playground', label: 'evaluator-playground' },
  { path: '/proposals', label: 'proposals' },
  { path: '/providers', label: 'providers' },
  { path: '/settings', label: 'settings' },
  { path: '/admin/invites', label: 'admin invites' },
];

for (const { path, label } of ROUTES) {
  test(`${label} loads without JS console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(path, { waitUntil: 'load' });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('navigation')).toBeVisible();
    expect(errors, `console errors on ${path}: ${errors.join('; ')}`).toHaveLength(0);
  });
}

test('unknown path redirects to the dashboard', async ({ page }) => {
  await page.goto('/does-not-exist', { waitUntil: 'load' });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation')).toBeVisible();
});
