import { test, expect } from '@playwright/test';
import {
  attachInPageFile,
  expectEditorCompact,
  fillEditor,
  readEditorLines,
  loadSample,
  SAMPLE_INVALID_TRAILING_COMMA,
} from './helpers';

test.describe('JSON Surgery — 本地 JSON 工作台', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('json-editor')).toBeVisible();
  });

  test('加载界面并显示空状态', async ({ page }) => {
    await expect(page.locator('.brand-title')).toHaveText('JSON Surgery');
    await expect(page.getByTestId('status-worker')).toBeVisible();
    await expect(page.getByText('100% 本地运行 · 数据不上传')).toBeVisible();
    await expect(page.getByTestId('btn-format')).toBeDisabled();
    await expect(page.getByTestId('btn-clear')).toBeDisabled();
    await expect(page.getByText('暂无结构')).toBeVisible();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('顶部作者 𝕏 链接指向正确地址', async ({ page }) => {
    const link = page.getByTestId('author-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('加载示例后校验、树形、统计、查询全部可用', async ({ page }) => {
    await loadSample(page);

    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('error-banner')).toHaveCount(0);
    await expect(page.getByTestId('tree-row').first()).toBeVisible();

    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('stats-panel')).toBeVisible();
    await expect(page.getByTestId('stat-depth')).not.toHaveText('0');
    await expect(page.getByTestId('stat-types')).toBeVisible();

    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-hit').first()).toBeVisible({ timeout: 20_000 });
  });

  test('定位语法错误的行列并跳转', async ({ page }) => {
    await fillEditor(page, SAMPLE_INVALID_TRAILING_COMMA);
    const banner = page.getByTestId('error-banner');
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('error-location')).toContainText('第 3 行');
    await expect(banner).toContainText('逗号');
    await page.getByTestId('error-goto').click();
    await expect(page.getByTestId('status-error')).toBeVisible();
  });

  test('拒绝缺失括号并给出明确原因', async ({ page }) => {
    await fillEditor(page, '{"a": [1, 2, 3}');
    await expect(page.getByTestId('error-banner')).toContainText('数组', { timeout: 20_000 });
  });

  test('对超出 2^53 的整数给出提示但仍视为有效 JSON', async ({ page }) => {
    await fillEditor(page, '{"big": 9007199254740993}');
    await expect(page.getByTestId('warn-banner')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('warn-banner')).toContainText('2^53');
    await expect(page.getByTestId('status-valid')).toBeVisible();
  });

  test('格式化、排序、压缩都真实改变文档内容', async ({ page }) => {
    await fillEditor(page, '{"b":1,"a":{"d":2,"c":3}}');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('btn-format').click();
    await expect(page.locator('.cm-content')).toContainText('"b": 1');

    await page.getByTestId('btn-sort').click();
    await expectEditorCompact(page, '{"a":{"c":3,"d":2},"b":1}');

    await page.getByTestId('btn-minify').click();
    await expectEditorCompact(page, '{"a":{"c":3,"d":2},"b":1}');
  });

  test('数字字面量在格式化后保持原样', async ({ page }) => {
    await fillEditor(page, '{"a":1.50,"b":1e3,"c":-0}');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('btn-format').click();
    const text = await readEditorLines(page);
    expect(text).toContain('1.50');
    expect(text).toContain('1e3');
    expect(text).toContain('-0');
  });

  test('复制整篇文档到剪贴板', async ({ page }) => {
    await fillEditor(page, '{"hello":"world"}');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('btn-copy').click();
    await expect(page.getByText('已复制到剪贴板')).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('hello');
  });

  test('下载 .json 文件', async ({ page }) => {
    await fillEditor(page, '{"download":true}');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('btn-download').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    expect(await download.path()).toBeTruthy();
  });

  test('通过文件选择器导入本地 .json', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles({
      name: 'imported.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"imported": [1, 2, 3]}', 'utf8'),
    });
    await expect(page.locator('.cm-content')).toContainText('imported');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.editor-title')).toContainText('imported.json');
  });

  test('拒绝超大文件并说明上限', async ({ page }) => {
    await attachInPageFile(page, 'huge.json', 33 * 1024 * 1024);
    await expect(page.getByText(/文件过大/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('status-valid')).toHaveCount(0);
  });

  test('搜索树、复制节点路径', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('tree-row').first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('tree-search').fill('bicycle');
    const row = page.locator('.tree-row.matched').first();
    await expect(row).toBeVisible();
    await row.hover();
    await row.getByTestId('copy-path').click();
    await expect(page.getByText('节点路径已复制到剪贴板')).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('$');
  });

  test('全部展开 / 全部折叠真实改变可见行数', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('tree-row').first()).toBeVisible({ timeout: 20_000 });
    const before = await page.getByTestId('tree-row').count();
    await page.getByTestId('expand-all').click();
    const after = await page.getByTestId('tree-row').count();
    expect(after).toBeGreaterThan(before);
    await page.getByTestId('collapse-all').click();
    await expect.poll(async () => page.getByTestId('tree-row').count()).toBe(1);
  });

  test('执行 JSONPath 查询并把命中定位回树形视图', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-input').fill('$.store.book[*].title');
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-hit')).toHaveCount(4);
    await page.getByTestId('query-hit').first().getByTestId('query-locate').click();
    await expect(page.getByTestId('tab-tree')).toHaveAttribute('aria-selected', 'true');
    const selected = page.locator('.tree-row.selected');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-path', '$.store.book[0].title');
  });

  test('非法 JSONPath 表达式给出错误而不是崩溃', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-input').fill('$..[?(@.price >)]');
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-error')).toBeVisible({ timeout: 20_000 });
  });

  test('展开 JSONPath 语法支持表', async ({ page }) => {
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-support-toggle').click();
    await expect(page.getByTestId('query-support-table')).toBeVisible();
    await expect(page.getByTestId('query-support-table')).toContainText('递归下降');
  });

  test('双栏 Diff 标记新增、删除与修改', async ({ page }) => {
    await page.getByTestId('tab-diff').click();
    await expect(page.getByTestId('json-editor')).toHaveCount(2);
    await fillEditor(page, '{"a":1,"b":2,"c":3}', 0);
    await fillEditor(page, '{"a":1,"b":9,"d":4}', 1);

    await expect(page.getByTestId('diff-panel')).toBeVisible({ timeout: 20_000 });
    const pills = page.locator('.diff-summary .pill');
    await expect(pills.filter({ hasText: '新增 1' })).toBeVisible();
    await expect(pills.filter({ hasText: '删除 1' })).toBeVisible();
    await expect(pills.filter({ hasText: '修改 1' })).toBeVisible();
    await expect(page.getByTestId('diff-row')).toHaveCount(3);
  });

  test('Diff 面板在两侧 JSON 相同时显示一致状态', async ({ page }) => {
    await page.getByTestId('tab-diff').click();
    await fillEditor(page, '{"same":true}', 0);
    await fillEditor(page, '{"same":true}', 1);
    await expect(page.getByTestId('diff-identical')).toBeVisible({ timeout: 20_000 });
  });

  test('深浅色主题切换并在刷新后保留', async ({ page }) => {
    const initial = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByTestId('btn-theme').click();
    const next = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(next).not.toBe(initial);
    await page.reload();
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe(next);
  });

  test('快捷键面板可以打开和关闭', async ({ page }) => {
    await page.getByTestId('btn-shortcuts').click();
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await expect(page.getByTestId('shortcuts-dialog')).toContainText('Ctrl');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcuts-dialog')).toHaveCount(0);
  });

  test('键盘快捷键执行格式化与主题切换', async ({ page }) => {
    await fillEditor(page, '{"z":1,"y":2}');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('Control+Shift+F');
    await expect(page.locator('.cm-content')).toContainText('"z": 1');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.keyboard.press('Control+Shift+T');
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before);
  });

  test('撤销 / 重做恢复文档', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('btn-copy')).toBeEnabled();

    await page.getByTestId('btn-clear').click();
    // An empty document disables the actions that need content.
    await expect(page.getByTestId('btn-copy')).toBeDisabled();

    await page.getByTestId('btn-undo').click();
    await expect(page.getByTestId('btn-copy')).toBeEnabled();
    await expect(page.locator('.cm-content')).toContainText('store');

    await page.getByTestId('btn-redo').click();
    await expect(page.getByTestId('btn-copy')).toBeDisabled();
  });

  test('编辑器内搜索面板可以用 Ctrl+F 打开', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+f');
    await expect(page.locator('.cm-search')).toBeVisible();
  });

  test('除同源静态资源外没有外部网络请求', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      const sameOrigin =
        url.startsWith('http://127.0.0.1:4193') || url.startsWith('data:') || url.startsWith('blob:');
      if (!sameOrigin) external.push(url);
    });
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-hit').first()).toBeVisible({ timeout: 20_000 });
    expect(external, `外部请求: ${external.join(', ')}`).toEqual([]);
  });

  test('大文档保持可用并给出处理状态', async ({ page }) => {
    const rows = Array.from({ length: 12000 }, (_, i) => `{"id":${i},"name":"row-${i}","ok":${i % 2 === 0}}`).join(',');
    await fillEditor(page, `[${rows}]`);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 40_000 });
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('stat-total-nodes')).toBeVisible();
    await page.getByTestId('tab-tree').click();
    await expect(page.getByTestId('tree-row').first()).toBeVisible();
    await page.getByTestId('tab-query').click();
    await expect(page.getByTestId('query-input')).toBeVisible();
  });
});
