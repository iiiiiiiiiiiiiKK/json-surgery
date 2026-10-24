import { describe, expect, it } from 'vitest';
import { computeStats, EMPTY_STATS } from '../lib/stats';
import { parseJson } from '../lib/parser';

function parseOk(text: string) {
  const result = parseJson(text);
  if (!result.ok) throw new Error(`解析失败: ${result.error.message}`);
  return result.value;
}

describe('computeStats', () => {
  it('统计空文档', () => {
    expect(computeStats(parseOk('{}'))).toEqual({ ...EMPTY_STATS, objects: 1, totalNodes: 1, maxDepth: 1 });
  });

  it('统计所有类型', () => {
    const value = parseOk(
      '{"s":"text","n":1,"b":true,"bf":false,"z":null,"o":{"k":1},"a":[1,2],"e":[],"eo":{}}',
    );
    const stats = computeStats(value);
    expect(stats.objects).toBe(3); // root, o, eo
    expect(stats.arrays).toBe(2); // a, e
    expect(stats.keys).toBe(10);
    expect(stats.strings).toBe(1);
    expect(stats.numbers).toBe(4); // n, o.k, a[0], a[1]
    expect(stats.booleans).toBe(2);
    expect(stats.nulls).toBe(1);
    expect(stats.maxDepth).toBe(3); // root -> o -> k
  });

  it('计算最大嵌套深度', () => {
    expect(computeStats(parseOk('1')).maxDepth).toBe(1);
    expect(computeStats(parseOk('{"a":{"b":{"c":1}}}')).maxDepth).toBe(4);
    expect(computeStats(parseOk('[[[[1]]]]')).maxDepth).toBe(5);
  });

  it('统计叶子值', () => {
    const stats = computeStats(parseOk('{"a":1,"b":[2,3]}'));
    expect(stats.leaves).toBe(3);
    expect(stats.totalNodes).toBe(5);
  });

  it('对深层嵌套不会栈溢出', () => {
    const deep = `${'['.repeat(200)}1${']'.repeat(200)}`;
    const stats = computeStats(parseOk(deep));
    expect(stats.maxDepth).toBe(201);
  });
});
