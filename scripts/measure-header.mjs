/**
 * Measure the mobile header: how much vertical space the toolbar takes and how
 * many rows it wraps into. Run against a preview server.
 *
 * Usage: node scripts/measure-header.mjs [url]
 */
import { chromium } from '@playwright/test';

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4193/';
const WIDTHS = [320, 360, 375, 390, 414, 428, 768, 860, 1024, 1440];

const browser = await chromium.launch();

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('json-editor').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const header = document.querySelector('header');
    const actions = document.querySelector('.header-actions');
    const brand = document.querySelector('.brand');
    const badge = document.querySelector('[data-testid="author-link"]');
    const ws = document.querySelector('.workspace');
    const mobileTabs = document.querySelector('.mobile-tabs');
    const status = document.querySelector('footer');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
    };

    // Count toolbar rows by grouping buttons by rounded top offset.
    const rows = new Map();
    document.querySelectorAll('.header-actions button, .header-actions select, .header-actions label').forEach((el) => {
      const r = el.getBoundingClientRect();
      const key = Math.round(r.top / 8) * 8;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(Math.round(r.width));
    });

    const vh = window.innerHeight;
    const headerH = header.getBoundingClientRect().height;
    const wsH = ws ? ws.getBoundingClientRect().height : 0;

    return {
      vh,
      header: rect(header),
      actions: rect(actions),
      brand: rect(brand),
      badge: rect(badge),
      mobileTabs: rect(mobileTabs),
      status: rect(status),
      workspaceH: Math.round(wsH),
      toolbarRows: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([top, widths]) => ({ top, count: widths.length, widths })),
      visibleButtons: document.querySelectorAll('.header-actions button').length,
    };
  });

  const chrome = (m.header?.h ?? 0) + (m.mobileTabs?.h ?? 0) + (m.status?.h ?? 0);
  console.log(
    [
      `${String(width).padStart(4)}px`,
      `header=${String(m.header?.h).padStart(3)}`,
      `tabs=${String(m.mobileTabs?.h ?? 0).padStart(2)}`,
      `status=${String(m.status?.h ?? 0).padStart(2)}`,
      `chrome=${String(chrome).padStart(3)} (${((chrome / m.vh) * 100).toFixed(0)}% of 844)`,
      `workspace=${String(m.workspaceH).padStart(3)}`,
      `toolbarRows=${m.toolbarRows.length}`,
      `buttons=${m.visibleButtons}`,
      `rows=${m.toolbarRows.map((r) => r.count).join('+')}`,
    ].join('  '),
  );

  await page.close();
}

await browser.close();
