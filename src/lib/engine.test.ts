import { describe, expect, it } from 'vitest';
import { analyzeText, diffText, formatText, queryText } from '../lib/engine';

describe('engine.analyzeText', () => {
  it('成功解析时返回统计与树节点', () => {
    const result = analyzeText('{"a":1,"b":[2]}');
    expect(result.ok).toBe(true);
    expect(result.stats?.totalNodes).toBe(4);
    expect(result.nodes?.length).toBe(4);
    expect(result.rootId).toBe('n0');
  });

  it('解析失败时返回定位信息', () => {
    const result = analyzeText('{"a":,}');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBeTruthy();
    expect(result.error?.line).toBe(1);
  });

  it('空输入返回错误而不是抛出异常', () => {
    const result = analyzeText('');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('EMPTY_INPUT');
  });
});

describe('engine.formatText', () => {
  it('格式化', () => {
    const result = formatText('{"a":1}', 'pretty', 2);
    expect(result.ok).toBe(true);
    expect(result.text).toBe('{\n  "a": 1\n}');
  });

  it('压缩', () => {
    const result = formatText('{\n  "a": 1\n}', 'minify');
    expect(result.text).toBe('{"a":1}');
  });

  it('排序', () => {
    const result = formatText('{"b":1,"a":2}', 'sort');
    expect(result.text?.indexOf('"a"')).toBeLessThan(result.text?.indexOf('"b"') ?? -1);
  });

  it('无效 JSON 返回错误', () => {
    const result = formatText('{', 'pretty');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('engine.queryText', () => {
  it('解析失败时返回可读错误', () => {
    const result = queryText('{', '$.a');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('JSON 解析失败');
  });

  it('正常查询', () => {
    const result = queryText('{"a":{"b":1}}', '$.a.b');
    expect(result.ok).toBe(true);
    expect(result.hits[0]?.value).toBe(1);
  });
});

describe('engine.diffText', () => {
  it('比较两个文档', () => {
    const result = diffText('{"a":1}', '{"a":2}');
    expect(result.result?.summary.changed).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('左侧无效时给出错误', () => {
    const result = diffText('{', '{"a":2}');
    expect(result.result).toBeNull();
    expect(result.error).toContain('左侧');
    expect(result.leftError).toBeTruthy();
  });

  it('右侧无效时给出错误', () => {
    const result = diffText('{"a":2}', '{');
    expect(result.result).toBeNull();
    expect(result.error).toContain('右侧');
    expect(result.rightError).toBeTruthy();
  });
});
