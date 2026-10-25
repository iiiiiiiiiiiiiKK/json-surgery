/**
 * Responsive + author-link audit.
 *
 * Measures the real rendered layout of a deployed build across desktop and
 * iPhone viewports. Nothing here is inferred from CSS: every check reads
 * geometry from the live DOM.
 *
 * Usage: node scripts/audit-responsive.mjs [url]
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const TARGET = process.argv[2] ?? 'https://iiiiiiiiiiiiiKK.github.io/json-surgery/';

const VIEWPORTS = [
  { name: 'iPhone SE (1st)', width: 320, height: 568, dpr: 2, touch: true },
  { name: 'iPhone SE (2/3)', width: 375, height: 667, dpr: 2, touch: true },
  { name: 'iPhone 13 mini', width: 375, height: 812, dpr: 3, touch: true },
  { name: 'iPhone 13', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'iPhone 13 Pro Max', width: 428, height: 926, dpr: 3, touch: true },
  { name: 'iPhone 15 Pro', width: 393, height: 852, dpr: 3, touch: true },
  { name: 'iPad mini portrait', width: 744, height: 1133, dpr: 2, touch: true },
  { name: 'iPad Pro 11 portrait', width: 834, height: 1194, dpr: 2, touch: true },
  { name: 'laptop small', width: 1024, height: 768, dpr: 1, touch: false },
  { name: 'laptop 1280', width: 1280, height: 800, dpr: 1, touch: false },
  { name: 'desktop 1440', width: 1440, height: 900, dpr: 1, touch: false },
  { name: 'desktop 1920', width: 1920, height: 1080, dpr: 1, touch: false },
];

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const results = [];
const record = (viewport, check, ok, detail) => {
  results.push({ viewport, check, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${viewport.padEnd(20)} ${check}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

/* ---------------------------------------------------------------- headers */
const headerChecks = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.touch,
    hasTouch: vp.touch,
    userAgent: vp.touch ? IOS_UA : undefined,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await page.getByTestId('json-editor').waitFor({ timeout: 30_000 });

  /* --- 1. author X link present, correct, inside the header, tappable --- */
  const link = page.getByTestId('author-link');
  const linkVisible = await link.isVisible();
  const href = await link.getAttribute('href');
  const target = await link.getAttribute('target');
  const rel = await link.getAttribute('rel');
  const box = await link.boundingBox();

  const inHeader = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="author-link"]');
    const h = document.querySelector('header');
    if (!a || !h) return null;
    const ar = a.getBoundingClientRect();
    const hr = h.getBoundingClientRect();
    return {
      insideHeader:
        ar.top >= hr.top - 1 && ar.bottom <= hr.bottom + 1 && ar.left >= hr.left - 1 && ar.right <= hr.right + 1,
      headerTop: Math.round(hr.top),
      linkTop: Math.round(ar.top),
      w: Math.round(ar.width),
      h: Math.round(ar.height),
    };
  });

  headerChecks.push({
    viewport: vp.name,
    width: vp.width,
    visible: linkVisible,
    href,
    target,
    rel,
    w: box ? Math.round(box.width) : 0,
    h: box ? Math.round(box.height) : 0,
    insideHeader: inHeader?.insideHeader ?? false,
    linkTop: inHeader?.linkTop ?? -1,
    headerTop: inHeader?.headerTop ?? -1,
  });

  record(
    vp.name,
    '作者 𝕏 链接可见且指向 x.com/0xkillcoin',
    linkVisible && href === 'https://x.com/0xkillcoin' && target === '_blank' && (rel ?? '').includes('noopener'),
    `href=${href} target=${target} ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)}`,
  );
  record(
    vp.name,
    '𝕏 链接位于顶部 header 内（第一屏可见区域）',
    inHeader?.insideHeader === true && (inHeader?.linkTop ?? 9999) < 120,
    `linkTop=${inHeader?.linkTop} headerTop=${inHeader?.headerTop}`,
  );
  record(
    vp.name,
    '𝕏 链接触控目标 ≥ 24×24（WCAG 2.5.8）',
    (box?.width ?? 0) >= 24 && (box?.height ?? 0) >= 24,
    `${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)}`,
  );

  /* --- 2. no horizontal overflow anywhere --- */
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
      }
    });
    return { scrollW: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 6) };
  });
  record(
    vp.name,
    '无横向溢出（scrollWidth ≤ clientWidth）',
    overflow.scrollW <= overflow.vw + 1 && overflow.offenders.length === 0,
    `scrollWidth=${overflow.scrollW} clientWidth=${overflow.vw}${overflow.offenders.length ? ` offenders=${overflow.offenders.join(' | ')}` : ''}`,
  );

  /* --- 3. layout mode: single-column tabs on phones, split on desktop --- */
  const layout = await page.evaluate(() => {
    const tabs = document.querySelector('.mobile-tabs');
    const tabsVisible = tabs ? getComputedStyle(tabs).display !== 'none' : false;
    const editor = document.querySelector('.pane-editor');
    const side = document.querySelector('.pane-side');
    const er = editor?.getBoundingClientRect();
    const sr = side?.getBoundingClientRect();
    return {
      tabsVisible,
      sideBySide: !!(er && sr && er.left < sr.left && er.right <= sr.left + 2),
    };
  });
  if (vp.width <= 860) {
    record(vp.name, '移动端：出现「编辑器 / 结果面板」切换标签', layout.tabsVisible === true, `tabs=${layout.tabsVisible}`);
  } else {
    record(vp.name, '桌面端：编辑器与结果面板左右并排', layout.sideBySide === true && !layout.tabsVisible, `sideBySide=${layout.sideBySide} tabs=${layout.tabsVisible}`);
  }

  /* --- 4. mobile tab switch really swaps panes --- */
  if (vp.width <= 860) {
    await page.getByTestId('mobile-tab-side').click();
    const sideVisible = await page.getByTestId('tab-tree').isVisible();
    const editorHidden = !(await page.getByTestId('json-editor').isVisible());
    await page.getByTestId('mobile-tab-editor').click();
    const editorBack = await page.getByTestId('json-editor').isVisible();
    record(
      vp.name,
      '移动端标签真实切换面板（非仅样式隐藏）',
      sideVisible && editorHidden && editorBack,
      `side=${sideVisible} editorHidden=${editorHidden} back=${editorBack}`,
    );

    /* --- 5. core flow still works on the phone --- */
    await page.getByTestId('btn-sample').click();
    await page.getByTestId('status-valid').waitFor({ timeout: 25_000 });
    await page.getByTestId('mobile-tab-side').click();
    await page.getByTestId('tab-stats').click();
    const depth = await page.getByTestId('stat-depth').innerText();
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-run').click();
    await page.getByTestId('query-hit').first().waitFor({ timeout: 25_000 });
    const hits = await page.getByTestId('query-hit').count();
    record(vp.name, '移动端核心流程（示例→统计→查询）可用', Number(depth.replace(/,/g, '')) > 0 && hits === 4, `maxDepth=${depth} hits=${hits}`);

    /* --- 6. touch targets: always-visible rail + overflow trigger --- */
    const small = [];
    for (const id of ['btn-format', 'btn-minify', 'btn-copy', 'btn-download', 'btn-sample', 'btn-open', 'btn-more', 'author-link']) {
      const b = await page.getByTestId(id).boundingBox();
      if (!b || b.height < 28 || b.width < 24) small.push(`${id}=${Math.round(b?.width ?? 0)}×${Math.round(b?.height ?? 0)}`);
    }
    record(vp.name, '常用操作触控目标 ≥ 24×28', small.length === 0, small.join(', '));

    /* --- 7. header budget: brand row + exactly one action row --- */
    const chrome = await page.evaluate(() => {
      const header = document.querySelector('header');
      const rail = document.querySelector('.mobile-rail');
      const workspace = document.querySelector('.workspace');
      const rows = new Set();
      if (rail) {
        rail.querySelectorAll('button').forEach((el) => {
          rows.add(Math.round(el.getBoundingClientRect().top / 4) * 4);
        });
      }
      return {
        headerH: Math.round(header.getBoundingClientRect().height),
        railButtons: rail ? rail.querySelectorAll('button').length : 0,
        railRows: rows.size,
        workspaceH: workspace ? Math.round(workspace.getBoundingClientRect().height) : 0,
      };
    });
    record(
      vp.name,
      '顶部固定两行（品牌行 + 常用操作行）',
      chrome.headerH <= 120 && chrome.railButtons === 6 && chrome.railRows === 1,
      `header=${chrome.headerH}px buttons=${chrome.railButtons} rows=${chrome.railRows} workspace=${chrome.workspaceH}px`,
    );
  }

  record(vp.name, '无 JS 运行时错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  await page.close();
  await context.close();
}

/* --------------- side-by-side summary across all viewports ------------- */
console.log('\n### 作者 𝕏 链接 — 全视口矩阵\n');
console.log('| 视口 | 宽度 | 可见 | 尺寸 | 在 header 内 | y 坐标 |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const h of headerChecks) {
  console.log(`| ${h.viewport} | ${h.width}px | ${h.visible ? '✅' : '❌'} | ${h.w}×${h.h} | ${h.insideHeader ? '✅' : '❌'} | ${h.linkTop}px |`);
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:');
  failed.forEach((f) => console.log(`  - ${f.viewport}: ${f.check} (${f.detail})`));
}

writeFileSync('docs/responsive-audit.json', JSON.stringify({ target: TARGET, at: new Date().toISOString(), results, headerChecks }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
