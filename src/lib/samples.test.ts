import { describe, expect, it } from 'vitest';
import { parseJson } from '../lib/parser';
import type { JsonValue } from '../lib/ast';
import {
  SAMPLES,
  VALID_SAMPLES,
  buildBulkSample,
  samplesByCategory,
} from '../lib/samples';

/**
 * The sample library is user-facing content: if a sample is malformed, the app
 * ships "example data" that immediately shows a red error banner. These tests
 * parse every sample so that can never happen.
 */
describe('样例数据', () => {
  it('每个样例都有唯一 id 与非空名称', () => {
    const ids = SAMPLES.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sample of SAMPLES) {
      expect(sample.name.trim().length).toBeGreaterThan(0);
      expect(sample.description.trim().length).toBeGreaterThan(0);
      expect(sample.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('标为有效的样例全部可以解析', () => {
    for (const sample of VALID_SAMPLES) {
      const result = parseJson(sample.text);
      expect(result.ok, `样例 ${sample.id} 解析失败：${result.ok ? '' : result.error.message}`).toBe(true);
    }
  });

  it('标为错误的样例确实无法解析', () => {
    for (const sample of SAMPLES.filter((item) => item.valid === false)) {
      const result = parseJson(sample.text);
      expect(result.ok, `样例 ${sample.id} 本应解析失败，但通过了`).toBe(false);
    }
  });

  it('错误样例给出的错误码符合预期', () => {
    const byId = new Map(SAMPLES.map((sample) => [sample.id, sample] as const));
    const codes: Array<[string, string]> = [
      ['invalid-comma', 'TRAILING_COMMA'],
      ['invalid-comment', 'UNEXPECTED_CHARACTER'],
      ['invalid-multi', 'TRAILING_CONTENT'],
      ['invalid-deep', 'DEPTH_EXCEEDED'],
    ];
    for (const [id, code] of codes) {
      const sample = byId.get(id);
      expect(sample, `缺少样例 ${id}`).toBeTruthy();
      const result = parseJson(sample!.text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    }
  });

  it('覆盖多种结构形态（广度）', () => {
    const parsed = VALID_SAMPLES.map((sample) => parseJson(sample.text));
    const rootTypes = new Set(parsed.map((result) => (result.ok ? result.value.type : 'invalid')));
    // Objects and arrays as root, plus at least one deeply nested document.
    expect(rootTypes.has('object')).toBe(true);
    expect(rootTypes.has('array')).toBe(true);

    const depthOf = (root: JsonValue): number => {
      let max = 0;
      const stack: Array<{ node: JsonValue; depth: number }> = [{ node: root, depth: 1 }];
      while (stack.length > 0) {
        const { node, depth } = stack.pop()!;
        max = Math.max(max, depth);
        if (node.type === 'object') {
          for (const entry of node.entries) stack.push({ node: entry.value, depth: depth + 1 });
        } else if (node.type === 'array') {
          for (const item of node.items) stack.push({ node: item, depth: depth + 1 });
        }
      }
      return max;
    };

    const depths = parsed.map((result) => (result.ok ? depthOf(result.value) : 0));
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(5);
  });

  it('分类分组按固定顺序返回', () => {
    const groups = samplesByCategory();
    expect(groups.length).toBeGreaterThanOrEqual(4);
    expect(groups[0]?.category).toBe('入门');
    for (const group of groups) expect(group.items.length).toBeGreaterThan(0);
  });

  it('批量样例是确定性的且大小合理', () => {
    const a = buildBulkSample();
    const b = buildBulkSample();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20_000);
    expect(a.length).toBeLessThan(120_000);
    const result = parseJson(a);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'object') {
      const orders = result.value.entries.find((entry) => entry.key === 'orders');
      expect(orders?.value.type).toBe('array');
      if (orders?.value.type === 'array') expect(orders.value.items).toHaveLength(120);
    }
  });

  it('批量样例支持自定义条数', () => {
    const small = buildBulkSample(5);
    const result = parseJson(small);
    expect(result.ok).toBe(true);
    expect(small).toContain('"count": 5');
  });
});
