import { test, expect } from '@playwright/test';
import { loadSample } from './helpers';

/**
 * iPhone layout + touch behaviour.
 *
 * These run under Playwright's real `iPhone 13` device profile: 390×844 CSS
 * pixels, DPR 3, touch, iOS Safari user agent. They assert the things that
 * actually break on a phone: horizontal overflow, an oversized header, tabs
 * that do not switch, unreachable controls, and tap targets that are too small.
 *
 * The compact header has a deliberate structure, and these tests lock it down:
 *   row 1 → brand · 𝕏 badge · ⋯ overflow
 *   row 2 → six always-visible actions (never wraps)
 *   ⋯     → bottom sheet with every secondary action
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

  test('顶部高度固定，不会因按钮换行而吃掉编辑区', async ({ page }) => {
    const box = await page.evaluate(() => {
      const header = document.querySelector('header')!;
      const height = header.getBoundingClientRect().height;
      const rail = document.querySelector('.mobile-rail') as HTMLElement | null;
      const railRows = new Set<number>();
      rail?.querySelectorAll('button').forEach((el) => {
        railRows.add(Math.round(el.getBoundingClientRect().top / 4) * 4);
      });
      return {
        height: Math.round(height),
        railCount: rail?.querySelectorAll('button').length ?? 0,
        railRows: railRows.size,
      };
    });

    // Brand row + one action row. 120px leaves headroom for large text scaling
    // while still failing if a third row ever sneaks back in.
    expect(box.height).toBeLessThanOrEqual(120);
    expect(box.railCount).toBe(6);
    expect(box.railRows, '常用操作栏必须只有一行').toBe(1);
  });

  test('常用操作栏的 6 个按钮都有文字标签且尺寸达标', async ({ page }) => {
    const rail = page.locator('.mobile-rail');
    await expect(rail).toBeVisible();
    const buttons = rail.locator('button');
    await expect(buttons).toHaveCount(6);

    const labels = await buttons.allInnerTexts();
    for (const label of ['格式化', '压缩', '复制', '下载', '示例', '打开']) {
      expect(labels.join('|')).toContain(label);
    }

    for (let i = 0; i < 6; i += 1) {
      const box = await buttons.nth(i).boundingBox();
      // 46px tall (≥ Apple's 44pt guidance), wide enough to tap without aiming.
      expect(box?.height ?? 0, `rail button ${i} height`).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0, `rail button ${i} width`).toBeGreaterThanOrEqual(44);
    }
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
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 25_000 });

    await page.getByTestId('mobile-tab-side').click();
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('stats-panel')).toBeVisible();

    await page.getByTestId('tab-query').click();
    await page.getByTestId('query-run').click();
    await expect(page.getByTestId('query-hit').first()).toBeVisible({ timeout: 25_000 });
  });

  test('⋯ 打开底部抽屉，抽屉里的次要操作真实生效', async ({ page }) => {
    const sheet = page.getByTestId('mobile-sheet');
    await expect(sheet).toBeHidden();

    await page.getByTestId('btn-more').click();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('btn-sort')).toBeVisible();
    await expect(page.getByTestId('btn-clear')).toBeVisible();
    await expect(page.getByTestId('indent-select')).toBeVisible();
    await expect(page.getByTestId('btn-panel')).toBeVisible();
    await expect(page.getByTestId('btn-theme')).toBeVisible();
    await expect(page.getByTestId('btn-shortcuts')).toBeVisible();

    // Theme really flips, and the sheet closes after acting.
    const before = await page.locator('html').getAttribute('data-theme');
    await page.getByTestId('btn-theme').click();
    await expect(sheet).toBeHidden();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);

    // Shortcuts dialog is reachable from the sheet.
    await page.getByTestId('btn-more').click();
    await page.getByTestId('btn-shortcuts').click();
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcuts-dialog')).toBeHidden();
  });

  test('抽屉支持点击遮罩与 Esc 关闭，关闭后焦点回到触发按钮', async ({ page }) => {
    await page.getByTestId('btn-more').click();
    await expect(page.getByTestId('mobile-sheet')).toBeVisible();
    await page.getByTestId('mobile-sheet-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('mobile-sheet')).toBeHidden();

    await page.getByTestId('btn-more').click();
    await expect(page.getByTestId('mobile-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mobile-sheet')).toBeHidden();
    await expect(page.getByTestId('btn-more')).toBeFocused();
  });

  test('抽屉里的排序真的改变了文档内容', async ({ page }) => {
    await loadSample(page);
    await expect(page.getByTestId('status-valid')).toBeVisible({ timeout: 25_000 });

    const before = await page.getByTestId('json-editor').locator('.cm-content').innerText();
    await page.getByTestId('btn-more').click();
    await page.getByTestId('btn-sort').click();
    await expect(page.getByTestId('mobile-sheet')).toBeHidden();
    await expect
      .poll(async () => page.getByTestId('json-editor').locator('.cm-content').innerText(), {
        timeout: 10_000,
      })
      .not.toBe(before);
  });

  test('作者 𝕏 链接在手机上可见且可点击', async ({ page }) => {
    const link = page.getByTestId('author-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
    await expect(link).toHaveAttribute('target', '_blank');
    const box = await link.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  });

  test('所有可点控件都不小于 28px 高', async ({ page }) => {
    const ids = ['btn-format', 'btn-minify', 'btn-copy', 'btn-download', 'btn-sample', 'btn-open', 'btn-more', 'author-link'];
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.height ?? 0, `${id} height`).toBeGreaterThanOrEqual(28);
      expect(box?.width ?? 0, `${id} width`).toBeGreaterThanOrEqual(24);
    }

    // Sheet rows are 48px tall — check them while the sheet is open.
    await page.getByTestId('btn-more').click();
    for (const id of ['btn-sort', 'btn-undo', 'btn-redo', 'btn-clear', 'btn-panel', 'btn-theme', 'btn-shortcuts']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.height ?? 0, `${id} height`).toBeGreaterThanOrEqual(44);
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
