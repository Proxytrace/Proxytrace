import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4299';
const OUT = '/tmp/claude-1000/wizard';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.route(url => url.pathname.startsWith('/api/'), async route => {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (p === '/api/auth/mode') return json({ mode: 'local', setupRequired: false, legacyClaimAvailable: false });
  if (p === '/api/setup/status') return json({ isConfigured: false });
  if (p === '/api/license') return json({
    tier: 'free', status: 'free', expiresAt: null, gracePeriodEndsAt: null, customerEmail: null,
    features: [], limits: { MaxProjects: 1, MaxAgents: 1, MaxTestSuites: 1, MaxTracesPerMonth: 10000, TraceRetentionDays: 14 },
  });
  if (p === '/api/setup/list-models') return json({ models: ['gpt-4o-mini', 'gpt-4o'] });
  if (p === '/api/setup/test-connection') return json({ success: true, error: null });
  return json({});
});

await page.goto(`${BASE}/setup`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="setup-welcome"]');
await page.screenshot({ path: `${OUT}/1-welcome.png`, fullPage: true });

await page.getByRole('button', { name: 'Next →' }).click();
await page.getByLabel('Upstream API key').fill('test-upstream-key');
await page.screenshot({ path: `${OUT}/2-provider.png`, fullPage: true });

await page.getByRole('button', { name: 'Next →' }).click(); // -> model (discovery mocked)
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/3-model.png`, fullPage: true });

await page.getByRole('button', { name: 'Next →' }).click(); // -> project
await page.getByLabel('Project name').fill('My Agent App');

await page.getByRole('button', { name: 'Next →' }).click(); // -> get started
await page.waitForSelector('[data-testid="setup-get-started"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/4-get-started-python.png`, fullPage: true });

await page.getByTestId('setup-snippet-tab-typescript').click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/5-get-started-typescript.png`, fullPage: true });

await page.getByTestId('setup-snippet-tab-csharp').click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/6-get-started-csharp.png`, fullPage: true });

await page.getByTestId('setup-snippet-tab-curl').click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/7-get-started-curl.png`, fullPage: true });

// reduced-motion sanity: sheen hidden
const cdp = await page.context().newCDPSession(page);
await page.emulateMedia({ reducedMotion: 'reduce' });
const sheenHidden = await page.evaluate(() => {
  const btn = document.querySelector('[data-testid="setup-get-started-btn"]');
  return getComputedStyle(btn, '::after').display === 'none';
});
console.log('reduced-motion sheen hidden:', sheenHidden);

await browser.close();
console.log('done');
