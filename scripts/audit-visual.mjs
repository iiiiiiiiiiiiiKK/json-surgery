/**
 * Visual/CSS contract audit: the three things the user asked to polish.
 *
 * 1. brand mark is a soft tinted tile, not a saturated gradient block
 * 2. the 𝕏 badge and the ⋯ trigger are the same shape/size/radius
 * 3. sample library is populated with broad, valid examples
 *
 * Reads computed styles from the live DOM — no screenshot interpretation needed.
 *
 * Usage: node scripts/audit-visual.mjs [url]
 */
import { chromium } from '@playwright/test';

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4193/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

const parseRgb = (text) => {
  const nums = String(text).match(/[\d.]+/g);
  if (!nums) return null;
  return nums.slice(0, 4).map(Number);
};

/**
 * Relative luminance of any CSS colour Chrome can serialise: `rgb()/rgba()`,
 * `color(srgb r g b / a)` (what `color-mix()` resolves to) and hex.
 * Returns 0..1, or null when the input cannot be understood.
 */
const luminance = (text) => {
  const value = String(text).trim();
  let r;
  let g;
  let b;

  const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) {
    r = Number(srgb[1]) * 255;
    g = Number(srgb[2]) * 255;
    b = Number(srgb[3]) * 255;
  } else if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const rgb = parseRgb(value);
    if (!rgb || rgb.length < 3 || rgb.some((n) => Number.isNaN(n))) return null;
    [r, g, b] = rgb;
  }

  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

for (const theme of ['dark', 'light']) {
  for (const viewport of [
    { label: 'desktop 1440', width: 1440, height: 900, mobile: false },
    { label: 'iPhone 13', width: 390, height: 844, mobile: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
    });
    const page = await context.newPage();
    await page.goto(TARGET);
    await page.getByTestId('json-editor').waitFor({ timeout: 30_000 });
    if (theme === 'light') {
      await page.getByTestId('btn-theme').click().catch(async () => {
        await page.getByTestId('btn-more').click();
        await page.getByTestId('btn-theme').click();
      });
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(150);

    const tag = `${viewport.label} · ${theme}`;

    /* ---- 1. brand mark is a tinted tile, not a saturated block ---- */
    const brand = await page.evaluate(() => {
      const el = document.querySelector('.brand-mark');
      const header = document.querySelector('header');
      if (!el || !header) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        bg: s.backgroundImage,
        headerBg: getComputedStyle(header).backgroundColor,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        color: s.color,
        border: s.borderTopColor,
        borderWidth: s.borderTopWidth,
        radius: s.borderTopLeftRadius,
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent ?? '').trim(),
      };
    });

    // Every colour stop in the gradient must sit close to the header surface.
    // A saturated block (the old #2dd4bf → #a78bfa fill) is far brighter than
    // the dark header; a tinted tile stays within a small delta.
    const stops = [...String(brand.bg).matchAll(/color\(srgb\s+[\d.]+\s+[\d.]+\s+[\d.]+/g)]
      .map((match) => luminance(match[0]))
      .filter((value) => value !== null);
    const headerLum = luminance(brand.headerBg) ?? 0;
    const maxDelta = stops.length ? Math.max(...stops.map((stop) => Math.abs(stop - headerLum))) : Number.POSITIVE_INFINITY;

    check(
      `${tag} · logo 是淡染块而非高饱和色块（与顶栏同色域）`,
      stops.length > 0 && maxDelta < 0.22,
      `亮度差 Δ=${maxDelta.toFixed(3)}（阈值 0.22，取到 ${stops.length} 个色标）`,
    );
    check(
      `${tag} · logo 有细边框与 10px 圆角（与面板同一套视觉语言）`,
      brand.borderWidth !== '0px' && brand.radius === '10px' && brand.w === 32 && brand.h === 32,
      `${brand.w}×${brand.h} radius=${brand.radius} border=${brand.borderWidth} ${brand.border}`,
    );

    /* ---- 2. 𝕏 badge and ⋯ trigger are the same object ---- */
    const pair = await page.evaluate(() => {
      const pick = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          h: Math.round(r.height),
          w: Math.round(r.width),
          radius: s.borderTopLeftRadius,
          borderWidth: s.borderTopWidth,
          borderColor: s.borderTopColor,
          bg: s.backgroundColor,
          display: s.display,
          alignItems: s.alignItems,
          justifyContent: s.justifyContent,
        };
      };
      return { x: pick('[data-testid="author-link"]'), more: pick('[data-testid="btn-more"]') };
    });

    if (viewport.mobile) {
      check(
        `${tag} · 𝕏 与 ⋯ 同形状同尺寸（圆角/边框/背景一致）`,
        !!pair.x &&
          !!pair.more &&
          pair.x.radius === pair.more.radius &&
          pair.x.h === pair.more.h &&
          pair.x.w === pair.more.w &&
          pair.x.borderWidth === pair.more.borderWidth &&
          pair.x.bg === pair.more.bg,
        `𝕏 ${pair.x?.w}×${pair.x?.h} r=${pair.x?.radius} | ⋯ ${pair.more?.w}×${pair.more?.h} r=${pair.more?.radius}`,
      );
    } else {
      check(
        `${tag} · 𝕏 徽标与工具栏按钮同一套圆角/高度语言`,
        !!pair.x && pair.x.h === 32 && pair.x.radius === '10px' && pair.x.borderWidth !== '0px',
        `𝕏 ${pair.x?.w}×${pair.x?.h} r=${pair.x?.radius} border=${pair.x?.borderWidth}`,
      );
    }

    /* ---- 3. sample library breadth ---- */
    await page.getByTestId('btn-sample').click();
    await page.getByTestId('sample-library').waitFor();
    const library = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-testid^="sample-item-"]'));
      const categories = Array.from(document.querySelectorAll('.picker-section .section-title')).map(
        (el) => el.textContent ?? '',
      );
      return {
        total: items.length,
        invalid: items.filter((el) => el.className.includes('invalid')).length,
        categories,
        names: items.map((el) => el.querySelector('.picker-item-name')?.textContent?.trim() ?? ''),
      };
    });

    check(
      `${tag} · 示例库有足够广度（≥19 个 / ≥5 类）`,
      library.total >= 19 && library.categories.length >= 5,
      `${library.total} 个 / ${library.categories.length} 类（${library.categories.join('/')}）`,
    );
    check(
      `${tag} · 示例库含故意错误样例并打了标记`,
      library.invalid >= 4,
      `${library.invalid} 个错误样例`,
    );

    if (viewport.mobile) {
      // The picker becomes a bottom sheet on phones: it must not overflow.
      // Wait for the slide-up animation to settle before measuring geometry,
      // otherwise the transform is still mid-flight and reads as overflow.
      await page.waitForTimeout(400);
      const sheet = await page.evaluate(() => {
        const panel = document.querySelector('.picker-panel');
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          bottomGap: Math.round(vh - r.bottom),
          vw,
          scrollW: document.documentElement.scrollWidth,
        };
      });
      check(
        `${tag} · 手机端示例库贴底抽屉、无横向溢出`,
        !!sheet && sheet.w <= sheet.vw + 1 && Math.abs(sheet.bottomGap) <= 1 && sheet.scrollW <= sheet.vw + 1,
        `panel ${sheet?.w}×${sheet?.h} bottomGap=${sheet?.bottomGap} scrollW=${sheet?.scrollW}`,
      );
    }

    await page.close();
    await context.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
