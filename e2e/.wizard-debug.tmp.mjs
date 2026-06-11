import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', m => console.log('CONSOLE', m.type(), m.text().slice(0, 200)));
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.route('**/api/**', async route => {
  const p = new URL(route.request().url()).pathname;
  console.log('API', p);
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (p === '/api/auth/mode') return json({ mode: 'local', setupRequired: false, legacyClaimAvailable: false });
  if (p === '/api/setup/status') return json({ isConfigured: false });
  if (p === '/api/license') return json({ tier: 'free', status: 'free', expiresAt: null, gracePeriodEndsAt: null, customerEmail: null, features: [], limits: {} });
  return json({});
});
await page.goto('http://localhost:4299/setup', { waitUntil: 'load' });
await page.waitForTimeout(3000);
console.log('BODY:', (await page.evaluate(() => document.body.innerText)).slice(0, 400));
await page.screenshot({ path: '/tmp/claude-1000/wizard/debug.png', fullPage: true });
await browser.close();
