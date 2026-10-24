import { describe, expect, it } from 'vitest';
import { diffJson } from '../lib/diff';
import { parseJson } from '../lib/parser';

function parseOk(text: string) {
  const result = parseJson(text);
  if (!result.ok) throw new Error(`解析失败: ${result.error.message}`);
  return result.value;
}

describe('diffJson', () => {
  it('相同文档没有差异', () => {
    const result = diffJson(parseOk('{"a":1,"b":[1,2]}'), parseOk('{"a":1,"b":[1,2]}'));
    expect(result.entries).toHaveLength(0);
    expect(result.summary.identical).toBe(true);
    expect(result.summary.total).toBe(0);
  });

  it('检测新增的键', () => {
    const result = diffJson(parseOk('{"a":1}'), parseOk('{"a":1,"b":2}'));
    expect(result.summary.added).toBe(1);
    expect(result.entries[0]?.kind).toBe('added');
    expect(result.entries[0]?.path).toBe('$.b');
  });

  it('检测删除的键', () => {
    const result = diffJson(parseOk('{"a":1,"b":2}'), parseOk('{"a":1}'));
    expect(result.summary.removed).toBe(1);
    expect(result.entries[0]?.kind).toBe('removed');
    expect(result.entries[0]?.path).toBe('$.b');
  });

  it('检测修改的标量', () => {
    const result = diffJson(parseOk('{"a":1}'), parseOk('{"a":2}'));
    expect(result.summary.changed).toBe(1);
    expect(result.entries[0]?.kind).toBe('changed');
    expect(result.entries[0]?.path).toBe('$.a');
  });

  it('检测类型变化', () => {
    const result = diffJson(parseOk('{"a":1}'), parseOk('{"a":"1"}'));
    expect(result.summary.typeChanged).toBe(1);
    expect(result.entries[0]?.kind).toBe('type-changed');
  });

  it('检测数组长度变化', () => {
    const result = diffJson(parseOk('{"a":[1,2]}'), parseOk('{"a":[1,2,3]}'));
    expect(result.summary.added).toBe(1);
    expect(result.entries[0]?.path).toBe('$.a[2]');
  });

  it('检测数组元素删除', () => {
    const result = diffJson(parseOk('{"a":[1,2,3]}'), parseOk('{"a":[1]}'));
    expect(result.summary.removed).toBe(2);
  });

  it('在嵌套结构中定位差异', () => {
    const result = diffJson(
      parseOk('{"user":{"profile":{"name":"a","age":1}}}'),
      parseOk('{"user":{"profile":{"name":"b","age":1}}}'),
    );
    expect(result.summary.changed).toBe(1);
    expect(result.entries[0]?.path).toBe('$.user.profile.name');
  });

  it('对包含 Unicode 的字符串比较', () => {
    const result = diffJson(parseOk('{"a":"中文"}'), parseOk('{"a":"中文"}'));
    expect(result.summary.identical).toBe(true);
  });

  it('比较 null 与 false 视为类型变化', () => {
    const result = diffJson(parseOk('{"a":null}'), parseOk('{"a":false}'));
    expect(result.summary.typeChanged).toBe(1);
  });
});
