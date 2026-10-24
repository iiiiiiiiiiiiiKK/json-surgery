import { describe, expect, it } from 'vitest';
import { formatJson, minifyJson, sortKeysDeep, compareKeys, formatBytes } from '../lib/format';
import { parseJson } from '../lib/parser';

function parseOk(text: string) {
  const result = parseJson(text);
  if (!result.ok) throw new Error(`解析失败: ${result.error.message}`);
  return result.value;
}

describe('formatJson', () => {
  it('格式化嵌套结构', () => {
    const value = parseOk('{"a":1,"b":[1,2],"c":{"d":null}}');
    expect(formatJson(value, { indent: 2 })).toBe(
      ['{', '  "a": 1,', '  "b": [', '    1,', '    2', '  ],', '  "c": {', '    "d": null', '  }', '}'].join('\n'),
    );
  });

  it('空容器不换行', () => {
    const value = parseOk('{"a":{},"b":[]}');
    expect(formatJson(value, { indent: 2 })).toBe('{\n  "a": {},\n  "b": []\n}');
  });

  it('支持不同缩进', () => {
    const value = parseOk('{"a":{"b":1}}');
    expect(formatJson(value, { indent: 4 })).toBe('{\n    "a": {\n        "b": 1\n    }\n}');
    expect(formatJson(value, { indent: 0 })).toBe('{\n"a": {\n"b": 1\n}\n}');
  });

  it('保留数字字面量', () => {
    const value = parseOk('{"a":1.50,"b":1e3}');
    expect(formatJson(value, { indent: 2 })).toContain('1.50');
    expect(formatJson(value, { indent: 2 })).toContain('1e3');
  });

  it('可选排序对象键但不改变数组顺序', () => {
    const value = parseOk('{"z":1,"a":[3,1,2]}');
    const sorted = formatJson(value, { indent: 2, sortKeys: true });
    expect(sorted.indexOf('"a"')).toBeLessThan(sorted.indexOf('"z"'));
    expect(sorted).toContain('[\n    3,\n    1,\n    2\n  ]');
  });
});

describe('minifyJson', () => {
  it('压缩为单行', () => {
    const value = parseOk('{\n  "a": 1,\n  "b": [1, 2, {"c": null}]\n}');
    expect(minifyJson(value)).toBe('{"a":1,"b":[1,2,{"c":null}]}');
  });

  it('压缩空容器', () => {
    expect(minifyJson(parseOk('{"a":{},"b":[]}'))).toBe('{"a":{},"b":[]}');
  });

  it('压缩后仍可以被解析且语义一致', () => {
    const source = '{"a":"\\u4e2d\\u6587","b":[1,2,3],"c":{"d":true,"e":null}}';
    const minified = minifyJson(parseOk(source));
    expect(minified).toBe('{"a":"中文","b":[1,2,3],"c":{"d":true,"e":null}}');
  });
});

describe('sortKeysDeep', () => {
  it('递归排序对象键', () => {
    const value = parseOk('{"b":{"d":1,"c":2},"a":3}');
    const sorted = formatJson(sortKeysDeep(value), { indent: 0 });
    expect(sorted).toBe('{\n"a": 3,\n"b": {\n"c": 2,\n"d": 1\n}\n}');
  });

  it('不改变数组顺序', () => {
    const value = parseOk('{"list":[3,1,2]}');
    const sorted = formatJson(sortKeysDeep(value), { indent: 0 });
    expect(sorted).toBe('{\n"list": [\n3,\n1,\n2\n]\n}');
  });
});

describe('compareKeys', () => {
  it('数字片段按数值比较', () => {
    expect(compareKeys('item2', 'item10')).toBeLessThan(0);
    expect(compareKeys('item10', 'item2')).toBeGreaterThan(0);
  });

  it('普通字符串按字典序', () => {
    expect(compareKeys('alpha', 'beta')).toBeLessThan(0);
  });
});

describe('formatBytes', () => {
  it('格式化不同量级', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});
