import { expect, type Page } from '@playwright/test';

/**
 * Put text into a CodeMirror 6 editor the way a human would.
 *
 * `keyboard.insertText` inserts the string in one transaction without firing
 * per-key handlers, so bracket auto-closing cannot mangle the JSON (typing it
 * character by character would).
 */
export async function fillEditor(page: Page, text: string, index = 0) {
  const host = page.getByTestId('json-editor').nth(index);
  await expect(host).toBeVisible();
  await host.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  if (text) await page.keyboard.insertText(text);
}

/** Read the document text currently held by an editor. */
export async function readEditor(page: Page, index = 0): Promise<string> {
  return page.getByTestId('json-editor').nth(index).locator('.cm-content').innerText();
}

/** Read only the document lines (excludes CodeMirror's placeholder widget). */
export async function readEditorLines(page: Page, index = 0): Promise<string> {
  const host = page.getByTestId('json-editor').nth(index);
  return host.locator('.cm-content').evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.cm-placeholder, .cm-gutters').forEach((node) => node.remove());
    return Array.from(clone.querySelectorAll('.cm-line'))
      .map((line) => line.textContent ?? '')
      .join('\n');
  });
}

/** Wait until the editor document equals `expected` (whitespace-insensitive). */
export async function expectEditorCompact(page: Page, expected: string, index = 0) {
  await expect.poll(async () => compact(await readEditorLines(page, index))).toBe(expected);
}

/**
 * Attach a file to the hidden `<input type=file>` without going through the OS
 * file system (Playwright would write a multi-megabyte temp file otherwise).
 */
export async function attachInPageFile(page: Page, name: string, bytes: number, mimeType = 'application/json') {
  await page.evaluate(
    ({ fileName, size, type }) => {
      const input = document.querySelector('[data-testid="file-input"]') as HTMLInputElement | null;
      if (!input) throw new Error('file input not found');
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(size).fill(0x20)], fileName, { type }));
      input.files = data.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { fileName: name, size: bytes, type: mimeType },
  );
}

/** Normalise whitespace so assertions can compare compact JSON. */
export function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * Load a sample through the sample library.
 *
 * The "示例" button opens a picker (category + search) rather than instantly
 * loading one fixed document, so every test that needs sample data goes through
 * this helper instead of duplicating the two clicks.
 */
export async function loadSample(page: Page, id = 'store') {
  await page.getByTestId('btn-sample').click();
  await expect(page.getByTestId('sample-library')).toBeVisible();
  await page.getByTestId(`sample-item-${id}`).click();
  await expect(page.getByTestId('sample-library')).toBeHidden();
}

export const SAMPLE_INVALID_TRAILING_COMMA = ['{', '  "a": 1,', '  "b": [1, 2,],', '  "c": true', '}'].join('\n');
