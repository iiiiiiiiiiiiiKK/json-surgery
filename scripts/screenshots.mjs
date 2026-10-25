// Screenshot capture for the README. Run with the preview server on :4193.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/assets';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// ---------- desktop ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:4193/');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/01-empty.png` });

// Sample library picker (28 samples across 5 categories + search).
await page.getByTestId('btn-sample').click();
await page.getByTestId('sample-library').waitFor();
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/18-sample-library.png` });

await page.getByTestId('sample-item-store').click();
await page.getByTestId('sample-library').waitFor({ state: 'hidden' });
await page.getByTestId('status-valid').waitFor({ timeout: 20000 });
await page.getByTestId('expand-all').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/02-tree.png` });

await page.getByTestId('tab-query').click();
await page.getByTestId('query-run').click();
await page.getByTestId('query-hit').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/03-query.png` });

await page.getByTestId('tab-stats').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/04-stats.png` });

await page.getByTestId('tab-diff').click();
await page.waitForTimeout(300);
const editors = page.getByTestId('json-editor');
await editors.nth(0).locator('.cm-content').click();
await page.keyboard.press('Control+a');
await page.keyboard.insertText('{"id":1,"name":"Ada","roles":["admin"],"active":true}');
await editors.nth(1).locator('.cm-content').click();
await page.keyboard.press('Control+a');
await page.keyboard.insertText('{"id":1,"name":"Ada Lovelace","roles":["admin","dev"],"active":false,"email":"ada@example.com"}');
await page.getByTestId('diff-panel').waitFor({ timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05-diff.png` });

// error state
await page.getByTestId('tab-tree').click();
await editors.nth(0).locator('.cm-content').click();
await page.keyboard.press('Control+a');
await page.keyboard.insertText('{\n  "a": 1,\n  "b": [1, 2,],\n  "c": true\n}');
await page.getByTestId('error-banner').waitFor({ timeout: 20000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/06-error.png` });

// light theme (same view)
await page.getByTestId('btn-theme').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/07-light.png` });
await page.getByTestId('btn-theme').click();

// shortcuts dialog
await page.getByTestId('btn-shortcuts').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/08-shortcuts.png` });
await page.keyboard.press('Escape');

await page.close();

// ---------- iPhone ----------
const mobile = await browser.newPage({ ...devices['iPhone 13'], deviceScaleFactor: 3 });
await mobile.goto('http://127.0.0.1:4193/');
await mobile.waitForTimeout(600);
await mobile.getByTestId('btn-sample').click();
await mobile.getByTestId('sample-library').waitFor();
await mobile.getByTestId('sample-item-store').click();
await mobile.getByTestId('sample-library').waitFor({ state: 'hidden' });
await mobile.getByTestId('status-valid').waitFor({ timeout: 20000 });
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: `${OUT}/09-mobile-editor.png` });
await mobile.getByTestId('mobile-tab-side').click();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: `${OUT}/10-mobile-tree.png` });
await mobile.getByTestId('tab-query').click();
await mobile.getByTestId('query-run').click();
await mobile.getByTestId('query-hit').first().waitFor({ timeout: 20000 });
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: `${OUT}/11-mobile-query.png` });
await mobile.close();

// ---------- iPhone SE (320px) — the narrowest phone still supported ----------
const small = await browser.newPage({
  viewport: { width: 320, height: 568 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await small.goto('http://127.0.0.1:4193/');
await small.waitForTimeout(600);
await small.getByTestId('btn-sample').click();
await small.getByTestId('sample-library').waitFor();
await small.getByTestId('sample-item-store').click();
await small.getByTestId('sample-library').waitFor({ state: 'hidden' });
await small.getByTestId('status-valid').waitFor({ timeout: 20000 });
await small.waitForTimeout(400);
await small.screenshot({ path: `${OUT}/13-mobile-320-editor.png` });
await small.getByTestId('mobile-tab-side').click();
await small.waitForTimeout(400);
await small.screenshot({ path: `${OUT}/14-mobile-320-tree.png` });
await small.close();

// ---------- author badge close-up (header only) ----------
const badge = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await badge.goto('http://127.0.0.1:4193/');
await badge.waitForTimeout(600);
await badge.locator('header').screenshot({ path: `${OUT}/15-header-desktop.png` });
await badge.close();

const badgeMobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await badgeMobile.goto('http://127.0.0.1:4193/');
await badgeMobile.waitForTimeout(600);
await badgeMobile.locator('header').screenshot({ path: `${OUT}/16-header-mobile.png` });

// ---------- bottom sheet (compact header overflow) ----------
await badgeMobile.getByTestId('btn-more').click();
await badgeMobile.getByTestId('mobile-sheet').waitFor({ timeout: 10000 });
await badgeMobile.waitForTimeout(450);
await badgeMobile.screenshot({ path: `${OUT}/17-mobile-sheet.png` });
await badgeMobile.close();

await browser.close();
console.log('screenshots written to', OUT);
