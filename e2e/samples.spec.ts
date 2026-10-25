import { test, expect } from '@playwright/test';

/**
 * Sample library.
 *
 * The "示例" button opens a picker with 20 samples grouped by category, a search
 * box, and an explicit "故意错误" badge on the broken ones. These tests lock down
 * the behaviour that matters: every sample loads, every valid one parses, and the
 * deliberately broken ones produce an error banner instead of silently loading.
 */
test.describe('示例数据', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('json-editor')).toBeVisible();
  });

  test('打开示例库：分组显示、数量正确、可搜索', async ({ page }) => {
    await page.getByTestId('btn-sample').click();
    const library = page.getByTestId('sample-library');
    await expect(library).toBeVisible();

    // Every category heading is rendered.
    for (const category of ['入门', 'API', '配置', '数据', '边界']) {
      await expect(library.getByText(category, { exact: true }).first()).toBeVisible();
    }

    const items = library.locator('[data-testid^="sample-item-"]');
    const total = await items.count();
    expect(total).toBeGreaterThanOrEqual(19);

    // A representative sample from each category exists.
    for (const id of ['store', 'api', 'schema', 'geojson', 'logs', 'bulk']) {
      await expect(page.getByTestId(`sample-item-${id}`)).toBeAttached();
    }

    // Search narrows the list, and clearing restores it.
    await page.getByTestId('sample-search').fill('geo');
    await expect(page.getByTestId('sample-item-geojson')).toBeVisible();
    await expect(page.getByTestId('sample-item-store')).toHaveCount(0);
    await page.getByTestId('sample-search').fill('');
    await expect(page.getByTestId('sample-item-store')).toBeVisible();

    // No match shows the empty message rather than a blank panel.
    await page.getByTestId('sample-search').fill('zzzz-no-such-sample');
    await expect(library.getByText('没有匹配的示例')).toBeVisible();
  });

  test('每个有效示例都能加载并校验通过', async ({ page }) => {
    await page.getByTestId('btn-sample').click();
    const library = page.getByTestId('sample-library');
    const ids = await library
      .locator('[data-testid^="sample-item-"]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute('data-testid') ?? '')
          .map((id) => id.replace('sample-item-', ''))
          .filter((id) => !id.startsWith('invalid-')),
      );

    expect(ids.length).toBeGreaterThanOrEqual(14);

    for (const id of ids) {
      if (!(await library.isVisible())) await page.getByTestId('btn-sample').click();
      await page.getByTestId(`sample-item-${id}`).click();
      await expect(page.getByTestId('sample-library')).toBeHidden();
      // Every non-broken sample must parse: a red banner here is a shipping bug.
      await expect(page.getByTestId('status-valid'), `样例 ${id} 应校验通过`).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('error-banner')).toHaveCount(0);
    }
  });

  test('故意错误的示例会给出错误定位而不是崩溃', async ({ page }) => {
    await page.getByTestId('btn-sample').click();
    await expect(page.getByTestId('sample-item-invalid-comma')).toBeVisible();
    await page.getByTestId('sample-item-invalid-comma').click();

    await expect(page.getByTestId('error-banner')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('error-location')).toContainText('行');
    await expect(page.getByTestId('sample-library')).toBeHidden();
  });

  test('示例库支持 Esc 与遮罩关闭，且数据不会被意外替换', async ({ page }) => {
    // Type something first.
    const host = page.getByTestId('json-editor');
    await host.locator('.cm-content').click();
    await page.keyboard.insertText('{"keep":"me"}');
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('btn-sample').click();
    await expect(page.getByTestId('sample-library')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('sample-library')).toBeHidden();

    // Content untouched after merely opening and closing the picker.
    await expect(host.locator('.cm-content')).toContainText('keep');

    // Backdrop click also closes.
    await page.getByTestId('btn-sample').click();
    await expect(page.getByTestId('sample-library')).toBeVisible();
    await page.getByTestId('sample-library-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('sample-library')).toBeHidden();
  });

  test('打开示例库后可以直接查询（示例 + JSONPath 联动）', async ({ page }) => {
    await page.getByTestId('btn-sample').click();
    await page.getByTestId('sample-item-store').click();
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-hit').first()).toBeVisible({ timeout: 20_000 });
  });
});
