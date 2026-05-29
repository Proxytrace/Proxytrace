import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', label: 'dashboard' },
  { path: '/traces', label: 'traces' },
  { path: '/agents', label: 'agents' },
  { path: '/suites', label: 'suites' },
  { path: '/proposals', label: 'proposals' },
  { path: '/providers', label: 'providers' },
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
