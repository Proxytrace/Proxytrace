// Shared Playwright helpers for Proxytrace manual screenshots.
//
// Reuses e2e/'s installed Playwright — run capture scripts from the e2e/ directory so
// `@playwright/test` resolves from e2e/node_modules:
//
//   (cd e2e && node ../manual/screenshots/<your-capture>.mjs)
//
// Targets the kiosk stack frontend (docker-compose.kiosk.yml) on :5201, which serves the
// production build with self-seeded demo data and no login. Bring the stack up first:
//
//   docker compose -f docker-compose.kiosk.yml up --build -d
//
// See .claude/skills/manual-screenshots/SKILL.md for the full workflow.
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));

// Reuse e2e/'s installed Playwright (no separate dependency for the manual). ESM resolves bare
// specifiers relative to THIS file's location, so a plain `import '@playwright/test'` looks in
// manual/node_modules and fails — resolve it explicitly from e2e/ instead. Requires e2e deps to be
// installed (cd e2e && npm install && npx playwright install chromium).
const require = createRequire(resolve(HERE, '../../e2e/package.json'));
const { chromium } = require('@playwright/test');

/** Kiosk frontend (nginx production build, proxies /api -> :5200). Override with SHOTS_BASE. */
export const BASE = process.env.SHOTS_BASE ?? 'http://localhost:5201';

/** Kiosk API (in-memory, self-seeded). Override with SHOTS_API. */
export const API_BASE = process.env.SHOTS_API ?? 'http://localhost:5200';

/** Committed-screenshot root: manual/public/screenshots. Build a page dir with `outDir(slug)`. */
export const OUT_ROOT = resolve(HERE, '../public/screenshots');

/** Absolute output dir for one manual page's shots, e.g. outDir('dashboard'). */
export function outDir(slug) {
  return resolve(OUT_ROOT, slug);
}

/**
 * Launch a browser tuned for crisp, stable, on-brand manual screenshots: fixed 1280x900
 * viewport, retina (deviceScaleFactor 2), forced dark theme to match the manual's
 * appearance:'force-dark', and reduced motion so animations don't smear captures.
 */
// Most app pages scroll inside an inner container, not the document, so Playwright's `fullPage`
// captures only the viewport. To grab more of such a page in one shot, raise `height`.
export async function launch({ width = 1280, height = 900 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Navigate to a kiosk route and wait for it to be visibly ready. Uses 'domcontentloaded'
 * (NOT 'networkidle' — the traces/runs views hold open SSE connections that never idle) plus an
 * explicit element wait. Always pass `waitFor` with a concrete selector for the page's content.
 */
export async function goto(page, route, waitFor) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  if (waitFor) await page.waitForSelector(waitFor, { state: 'visible' });
}

/**
 * Settle, then capture. Pass `selector` to crop to a single element (component close-up);
 * otherwise captures the full page. Creates the output directory as needed.
 */
export async function shot(page, outPath, { selector, fullPage = true, settleMs = 350 } = {}) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(settleMs);
  await mkdir(dirname(outPath), { recursive: true });
  if (selector) {
    await page.locator(selector).screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage });
  }
  console.log(`shot -> ${outPath}`);
}

/** Poll the kiosk API until healthy. Cold .NET start + seeding can take ~20s. */
export async function waitForReady({ timeoutMs = 120_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // stack not up yet
    }
    if (Date.now() > deadline) throw new Error(`kiosk not ready after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
