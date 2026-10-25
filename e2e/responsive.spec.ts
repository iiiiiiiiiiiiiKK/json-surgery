import { test, expect } from '@playwright/test';

/**
 * Responsive matrix: the author badge and the layout contract.
 *
 * These run in a single project (Chromium) and resize the viewport per test, so
 * a failure tells you exactly which width broke. They exist because the 𝕏 badge
 * and the two-pane workbench are the two things most easily broken by a CSS
 * change: the badge must stay on the first header line, and the panes must
 * never overflow horizontally at any width.
 */

const WIDTHS = [
  { label: 'iPhone SE (1st) 320', width: 320, height: 568, mobile: true },
  { label: 'iPhone SE (2/3) 375', width: 375, height: 667, mobile: true },
  { label: 'iPhone 13 390', width: 390, height: 844, mobile: true },
  { label: 'iPhone 13 Pro Max 428', width: 428, height: 926, mobile: true },
  { label: 'iPad mini 744', width: 744, height: 1133, mobile: true },
  { label: 'iPad Pro 11 834', width: 834, height: 1194, mobile: true },
  { label: 'small laptop 1024', width: 1024, height: 768, mobile: false },
  { label: 'laptop 1280', width: 1280, height: 800, mobile: false },
  { label: 'desktop 1440', width: 1440, height: 900, mobile: false },
  { label: 'desktop 1920', width: 1920, height: 1080, mobile: false },
];

for (const vp of WIDTHS) {
  test.describe(`响应式 @ ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('作者 𝕏 徽标在第一行右侧且可点击', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('json-editor')).toBeVisible();

      const link = page.getByTestId('author-link');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);

      const geometry = await page.evaluate(() => {
        const a = document.querySelector('[data-testid="author-link"]') as HTMLElement | null;
        const header = document.querySelector('header') as HTMLElement | null;
        const more = document.querySelector('[data-testid="btn-more"]') as HTMLElement | null;
        if (!a || !header) return null;
        const ar = a.getBoundingClientRect();
        const hr = header.getBoundingClientRect();
        const mr = more ? more.getBoundingClientRect() : null;
        return {
          insideHeader:
            ar.top >= hr.top - 1 && ar.bottom <= hr.bottom + 1 && ar.left >= hr.left - 1 && ar.right <= hr.right + 1,
          top: ar.top,
          left: ar.left,
          right: ar.right,
          width: ar.width,
          height: ar.height,
          viewportWidth: document.documentElement.clientWidth,
          // Compact header: the only thing allowed to sit right of the badge is
          // the overflow (⋯) trigger on the same row.
          rowMatesRightOfBadge: mr ? mr.left >= ar.right - 1 : false,
        };
      });

      expect(geometry).not.toBeNull();
      expect(geometry!.insideHeader).toBe(true);
      // First visible row: the badge must not be pushed below the fold of a
      // wrapped toolbar.
      expect(geometry!.top).toBeLessThan(40);
      // Right side of the first row: either flush with the edge (desktop) or
      // immediately followed by the ⋯ trigger (compact header).
      expect(geometry!.right).toBeLessThanOrEqual(geometry!.viewportWidth + 1);
      const gapToEdge = geometry!.viewportWidth - geometry!.right;
      expect(gapToEdge < 40 || geometry!.rowMatesRightOfBadge).toBe(true);
      // Right half of the screen, not lost in the middle.
      expect(geometry!.left).toBeGreaterThan(geometry!.viewportWidth / 2);
      // WCAG 2.5.8 minimum target size.
      expect(geometry!.width).toBeGreaterThanOrEqual(24);
      expect(geometry!.height).toBeGreaterThanOrEqual(24);
    });

    test('没有横向溢出', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('json-editor')).toBeVisible();

      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const offenders: string[] = [];
        document.querySelectorAll<HTMLElement>('*').forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > vw + 1) {
            offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
          }
        });
        return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 6) };
      });

      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.vw + 1);
      expect(overflow.offenders).toEqual([]);
    });

    test(vp.mobile ? '单栏 + 切换标签' : '双栏并排 + 无切换标签', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('json-editor')).toBeVisible();

      const layout = await page.evaluate(() => {
        const tabs = document.querySelector('.mobile-tabs') as HTMLElement | null;
        const tabsVisible = tabs ? getComputedStyle(tabs).display !== 'none' : false;
        const editor = document.querySelector('.pane-editor') as HTMLElement | null;
        const side = document.querySelector('.pane-side') as HTMLElement | null;
        const er = editor?.getBoundingClientRect();
        const sr = side?.getBoundingClientRect();
        return { tabsVisible, sideBySide: !!(er && sr && er.left < sr.left && er.right <= sr.left + 2) };
      });

      if (vp.width <= 860) {
        expect(layout.tabsVisible).toBe(true);
        // Real pane swap, not just CSS hiding of contents.
        await page.getByTestId('mobile-tab-side').click();
        await expect(page.getByTestId('tab-tree')).toBeVisible();
        await expect(page.getByTestId('json-editor')).not.toBeVisible();
        await page.getByTestId('mobile-tab-editor').click();
        await expect(page.getByTestId('json-editor')).toBeVisible();
      } else {
        expect(layout.tabsVisible).toBe(false);
        expect(layout.sideBySide).toBe(true);
      }
    });
  });
}
