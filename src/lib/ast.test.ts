import { describe, expect, it } from 'vitest';
import { fromPlain, toPlain, valuesEqual, cloneValue, previewOf, childCount } from '../lib/ast';

describe('toPlain / fromPlain', () => {
  it('往返转换保持结构', () => {
    const source = { a: 1, b: [1, 'two', null, true], c: { d: false } };
    const roundTrip = toPlain(fromPlain(source));
    expect(roundTrip).toEqual(source);
  });

  it('保留 null 与布尔值', () => {
    const value = fromPlain({ a: null, b: false, c: true });
    const plain = toPlain(value) as Record<string, unknown>;
    expect(plain.a).toBe(null);
    expect(plain.b).toBe(false);
    expect(plain.c).toBe(true);
  });
});

describe('valuesEqual', () => {
  it('结构相同即相等', () => {
    expect(valuesEqual(fromPlain({ a: [1, 2] }), fromPlain({ a: [1, 2] }))).toBe(true);
  });

  it('类型不同则不相等', () => {
    expect(valuesEqual(fromPlain({ a: 1 }), fromPlain({ a: '1' }))).toBe(false);
  });

  it('键顺序不影响相等性', () => {
    expect(valuesEqual(fromPlain({ a: 1, b: 2 }), fromPlain({ b: 2, a: 1 }))).toBe(true);
  });
});

describe('cloneValue', () => {
  it('深拷贝互不影响', () => {
    const original = fromPlain({ a: [1, 2] });
    const copy = cloneValue(original);
    expect(valuesEqual(original, copy)).toBe(true);
    const obj = original.type === 'object' ? original : null;
    if (obj) obj.entries[0]!.value = fromPlain(999);
    expect(valuesEqual(original, copy)).toBe(false);
  });
});

describe('previewOf / childCount', () => {
  it('容器显示摘要', () => {
    expect(previewOf(fromPlain({ a: 1 }))).toContain('1 key');
    expect(previewOf(fromPlain([1, 2, 3]))).toContain('3 items');
    expect(previewOf(fromPlain({}))).toBe('{}');
    expect(previewOf(fromPlain([]))).toBe('[]');
  });

  it('字符串带引号', () => {
    expect(previewOf(fromPlain('hi'))).toBe('"hi"');
  });

  it('childCount 统计子节点', () => {
    expect(childCount(fromPlain({ a: 1, b: 2 }))).toBe(2);
    expect(childCount(fromPlain([1]))).toBe(1);
    expect(childCount(fromPlain(1))).toBe(0);
  });
});
