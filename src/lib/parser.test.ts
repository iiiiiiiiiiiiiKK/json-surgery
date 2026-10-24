import { describe, expect, it } from 'vitest';
import { parseJson } from '../lib/parser';

describe('parseJson — 合法输入', () => {
  it('解析空对象与空数组', () => {
    const obj = parseJson('{}');
    expect(obj.ok).toBe(true);
    if (obj.ok) {
      expect(obj.value.type).toBe('object');
      expect(obj.value.type === 'object' && obj.value.entries).toHaveLength(0);
    }

    const arr = parseJson('[]');
    expect(arr.ok).toBe(true);
    if (arr.ok) {
      expect(arr.value.type).toBe('array');
      expect(arr.value.type === 'array' && arr.value.items).toHaveLength(0);
    }
  });

  it('解析 null / true / false', () => {
    for (const [input, type] of [
      ['null', 'null'],
      ['true', 'boolean'],
      ['false', 'boolean'],
    ] as const) {
      const result = parseJson(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.type).toBe(type);
    }
  });

  it('保留对象键的原始顺序', () => {
    const result = parseJson('{"z":1,"a":2,"m":3}');
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'object') {
      expect(result.value.entries.map((entry) => entry.key)).toEqual(['z', 'a', 'm']);
    }
  });

  it('保留数字字面量的原始写法', () => {
    const result = parseJson('{"a":1.50,"b":1e3,"c":-0,"d":0.0}');
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'object') {
      const raws = result.value.entries.map((entry) =>
        entry.value.type === 'number' ? entry.value.raw : null,
      );
      expect(raws).toEqual(['1.50', '1e3', '-0', '0.0']);
    }
  });

  it('解析 Unicode 与转义字符', () => {
    const result = parseJson('{"u":"\\u4e2d\\u6587","e":"😀","s":"a\\nb\\tc\\\\d\\"e"}');
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'object') {
      const parsed = result.value;
      const get = (key: string) => {
        const entry = parsed.entries.find((item) => item.key === key);
        return entry?.value.type === 'string' ? entry.value.value : null;
      };
      expect(get('u')).toBe('中文');
      expect(get('e')).toBe('😀');
      expect(get('s')).toBe('a\nb\tc\\d"e');
    }
  });

  it('接受 RFC 8259 允许的顶层标量', () => {
    expect(parseJson('42').ok).toBe(true);
    expect(parseJson('"hello"').ok).toBe(true);
    expect(parseJson('  \n 123 \n ').ok).toBe(true);
  });
});

describe('parseJson — 非法输入', () => {
  it('拒绝空输入', () => {
    const result = parseJson('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMPTY_INPUT');
  });

  it('拒绝多余逗号并定位到正确位置', () => {
    const result = parseJson('{\n  "a": 1,\n  "b": 2,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TRAILING_COMMA');
      expect(result.error.line).toBe(4);
      expect(result.error.column).toBe(1);
    }
  });

  it('拒绝数组中的多余逗号', () => {
    const result = parseJson('[1, 2, ]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TRAILING_COMMA');
  });

  it('检测缺失的右括号', () => {
    const result = parseJson('{"a": [1, 2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNEXPECTED_END');
  });

  it('检测错误的花括号', () => {
    const result = parseJson('{"a": 1}');
    expect(result.ok).toBe(true);

    const broken = parseJson('{"a": 1');
    expect(broken.ok).toBe(false);
  });

  it('检测缺失的冒号', () => {
    const result = parseJson('{"a" 1}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNEXPECTED_CHARACTER');
      expect(result.error.message).toContain('冒号');
    }
  });

  it('检测未加引号的键', () => {
    const result = parseJson('{a: 1}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('双引号');
  });

  it('拒绝单引号', () => {
    const result = parseJson("{'a': 1}");
    expect(result.ok).toBe(false);
  });

  it('拒绝尾随逗号之外的尾随内容', () => {
    const result = parseJson('{"a":1} extra');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TRAILING_CONTENT');
  });

  it('拒绝尾随逗号 / 注释', () => {
    expect(parseJson('{"a":1,}').ok).toBe(false);
    expect(parseJson('{"a":1} // comment').ok).toBe(false);
  });

  it('拒绝无效的数字', () => {
    for (const input of ['01', '1.', '.5', '+1', '1e', '1e+', '--1']) {
      expect(parseJson(input).ok, `输入 ${input} 应该无效`).toBe(false);
    }
  });

  it('拒绝无效的转义字符', () => {
    const result = parseJson('{"a": "\\x"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ESCAPE');
  });

  it('拒绝长度不足的 Unicode 转义', () => {
    const result = parseJson('{"a": "\\u12"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ESCAPE');
  });

  it('拒绝未转义的控制字符', () => {
    const result = parseJson('{"a": "line\nbreak"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_STRING');
  });

  it('拒绝重复键', () => {
    const result = parseJson('{"a":1,"a":2}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('重复');
  });

  it('报告错误行列位置', () => {
    const result = parseJson('{\n  "a": 1,\n  "b": @\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(3);
      expect(result.error.column).toBe(8);
    }
  });
});

describe('parseJson — 边界保护', () => {
  it('拒绝超过深度上限的文档', () => {
    const deep = `${'['.repeat(40)}1${']'.repeat(40)}`;
    const result = parseJson(deep, { maxDepth: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DEPTH_EXCEEDED');
  });

  it('接受默认深度以内的文档', () => {
    const deep = `${'['.repeat(50)}1${']'.repeat(50)}`;
    expect(parseJson(deep).ok).toBe(true);
  });

  it('拒绝超过长度上限的输入', () => {
    const result = parseJson('{"a":1}', { maxLength: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SIZE_EXCEEDED');
  });
});
