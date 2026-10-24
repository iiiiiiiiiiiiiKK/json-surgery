import { test, expect } from '@playwright/test';

/**
 * iPhone layout + touch behaviour.
 *
 * These run under Playwright's real `iPhone 13` device profile: 390×844 CSS
 * pixels, DPR 3, touch, iOS Safari user agent. They assert the things that
 * actually break on a phone: horizontal overflow, unreachable controls, tabs
 * that do not switch, and tap targets that are too small.
 */
test.describe('JSON Surgery — 手机端（iPhone 13）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('json-editor')).toBeVisible();
  });

  test('没有横向溢出，页面宽度等于视口宽度', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const viewWidth = document.documentElement.clientWidth;
      const offenders: string[] = [];
      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > viewWidth + 1) {
          offenders.push(`${el.tagName}.${el.className}`.slice(0, 80));
        }
      });
      return { docWidth, viewWidth, offenders: offenders.slice(0, 5) };
    });
    expect(overflow.docWidth).toBeLessThanOrEqual(overflow.viewWidth + 1);
    expect(overflow.offenders).toEqual([]);
  });

  test('移动端标签可以在编辑器与结果面板之间切换', async ({ page }) => {
    const tabs = page.locator('.mobile-tabs');
    await expect(tabs).toBeVisible();

    await expect(page.getByTestId('json-editor')).toBeVisible();
    await page.getByTestId('mobile-tab-side').click();
    await expect(page.getByTestId('tab-tree')).toBeVisible();

    await page.getByTestId('mobile-tab-editor').click();
    await expect(page.getByTestId('json-editor')).toBeVisible();
  });

  test('手机上仍能加载示例、查看统计与查询', async ({ page }) => {
    await page.getByTestId('mobile-tab-side').click();
    await page.getByTestId('mobile-tab-editor').click();

    // Toolbar buttons are icon-only at this width but still reachable by test id.
    await page.getByTestId('btn-sample').click();
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 25_000 });

    await page.getByTestId('mobile-tab-side').click();
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('stats-panel')).toBeVisible();

    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-hit').first()).toBeVisible({ timeout: 25_000 });
  });

  test('作者 𝕏 链接在手机上可见且可点击', async ({ page }) => {
    const link = page.getByTestId('author-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
    const box = await link.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(16);
    expect(box?.height ?? 0).toBeGreaterThan(16);
  });

  test('主要按钮的触点尺寸不小于 28px', async ({ page }) => {
    for (const id of ['btn-format', 'btn-theme', 'btn-shortcuts', 'btn-panel']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.height ?? 0, `${id} height`).toBeGreaterThanOrEqual(28);
      expect(box?.width ?? 0, `${id} width`).toBeGreaterThanOrEqual(24);
    }
  });

  test('移动端 Diff 视图也不会横向溢出', async ({ page }) => {
    await page.getByTestId('mobile-tab-side').click();
    await page.getByTestId('tab-diff').click();
    const overflow = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const viewWidth = document.documentElement.clientWidth;
      return { docWidth, viewWidth };
    });
    expect(overflow.docWidth).toBeLessThanOrEqual(overflow.viewWidth + 1);
  });
});
