/**
 * Production verification against a deployed URL.
 *
 * Usage: node scripts/verify-live.mjs [url]
 * Default: https://iiiiiiiiiiiiiKK.github.io/json-surgery/
 */
import { chromium, devices } from '@playwright/test';

const TARGET = process.argv[2] ?? 'https://iiiiiiiiiiiiiKK.github.io/json-surgery/';
const ALLOWED_HOST = new globalThis.URL(TARGET).hostname.toLowerCase();

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();

// ---------- desktop ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const external = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('request', (r) => {
  const u = r.url();
  if (u.startsWith('data:') || u.startsWith('blob:')) return;
  try {
    const host = new globalThis.URL(u).hostname.toLowerCase();
    if (host !== ALLOWED_HOST && !host.endsWith('.github.io')) external.push(u);
  } catch {
    external.push(u);
  }
});

const resp = await page.goto(TARGET, { waitUntil: 'networkidle' });
check('页面返回 200', resp?.status() === 200, `status=${resp?.status()}`);

await page.getByTestId('json-editor').waitFor({ timeout: 30000 });
check('编辑器渲染', await page.getByTestId('json-editor').isVisible());
check('品牌标题', (await page.locator('.brand-title').innerText()) === 'JSON Surgery');
check('作者 X 链接', (await page.getByTestId('author-link').getAttribute('href')) === 'https://x.com/0xkillcoin');

await page.getByTestId('btn-sample').click();
await page.getByTestId('sample-library').waitFor();
await page.getByTestId('sample-item-store').click();
await page.getByTestId('sample-library').waitFor({ state: 'hidden' });
await page.getByTestId('status-valid').waitFor({ timeout: 30000 });
check('示例载入并校验通过', true);

await page.getByTestId('btn-format').click();
await page.waitForTimeout(600);
check('格式化执行', (await page.locator('.cm-content').innerText()).includes('"store": {'));

await page.getByTestId('tab-stats').click();
await page.waitForTimeout(400);
const depth = await page.getByTestId('stat-depth').innerText();
check('统计面板有数据', Number(depth.replace(/,/g, '')) > 0, `maxDepth=${depth}`);

await page.getByTestId('tab-query').click();
await page.getByTestId('query-run').click();
await page.getByTestId('query-hit').first().waitFor({ timeout: 30000 });
check('JSONPath 查询命中 4 条', (await page.getByTestId('query-hit').count()) === 4);

await page.getByTestId('query-hit').first().getByTestId('query-locate').click();
await page.waitForTimeout(900);
check('查询结果可定位回树形', (await page.locator('.tree-row.selected').count()) === 1);

await page.getByTestId('tab-tree').click();
const host = page.getByTestId('json-editor').nth(0);
await host.locator('.cm-content').click();
await page.keyboard.press('Control+a');
await page.keyboard.insertText('{\n  "a": 1,\n  "b": [1, 2,],\n}');
await page.getByTestId('error-banner').waitFor({ timeout: 30000 });
const loc = await page.getByTestId('error-location').innerText();
check('错误行列提示', loc.includes('第 3 行'), loc);

await page.getByTestId('tab-diff').click();
await page.waitForTimeout(400);
const eds = page.getByTestId('json-editor');
await eds.nth(0).locator('.cm-content').click();
await page.keyboard.press('Control+a');
await page.keyboard.insertText('{"a":1,"b":2,"c":3}');
await eds.nth(1).locator('.cm-content').click();
await page.keyboard.press('Control+a');
await page.keyboard.insertText('{"a":1,"b":9,"d":4}');
await page.getByTestId('diff-panel').waitFor({ timeout: 30000 });
const pills = await page.locator('.diff-summary .pill').allInnerTexts();
check(
  'Diff 标出新增/删除/修改',
  pills.some((p) => p.includes('新增')) &&
    pills.some((p) => p.includes('删除')) &&
    pills.some((p) => p.includes('修改')),
  pills.join(' / '),
);

check('无 JS 运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));
check('无第三方外部请求', external.length === 0, external.slice(0, 3).join(' | '));
await page.close();

// ---------- iPhone ----------
const mobile = await browser.newPage({ ...devices['iPhone 13'] });
await mobile.goto(TARGET, { waitUntil: 'networkidle' });
await mobile.getByTestId('json-editor').waitFor({ timeout: 30000 });
const overflow = await mobile.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const off = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) off.push(`${el.tagName}.${el.className}`.slice(0, 50));
  });
  return { doc: document.documentElement.scrollWidth, vw, off: off.slice(0, 5) };
});
check('iPhone 无横向溢出', overflow.doc <= overflow.vw + 1 && overflow.off.length === 0, JSON.stringify(overflow));
check('iPhone 移动端切换标签可见', await mobile.locator('.mobile-tabs').isVisible());

await mobile.getByTestId('btn-sample').click();
await mobile.getByTestId('sample-library').waitFor();
await mobile.getByTestId('sample-item-store').click();
await mobile.getByTestId('sample-library').waitFor({ state: 'hidden' });
await mobile.getByTestId('status-valid').waitFor({ timeout: 30000 });
await mobile.getByTestId('mobile-tab-side').click();
await mobile.getByTestId('tab-query').click();
await mobile.getByTestId('query-run').click();
await mobile.getByTestId('query-hit').first().waitFor({ timeout: 30000 });
check('iPhone 查询可用', (await mobile.getByTestId('query-hit').count()) === 4);
check('iPhone 作者 X 链接可见', await mobile.getByTestId('author-link').isVisible());
await mobile.screenshot({ path: 'docs/assets/12-live-mobile.png' });
await mobile.close();

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
