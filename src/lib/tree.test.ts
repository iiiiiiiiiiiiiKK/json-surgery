import { describe, expect, it } from 'vitest';
import { buildTree, pathSegmentForKey, applySearch } from '../lib/tree';
import { parseJson } from '../lib/parser';

function parseOk(text: string) {
  const result = parseJson(text);
  if (!result.ok) throw new Error(`解析失败: ${result.error.message}`);
  return result.value;
}

describe('pathSegmentForKey', () => {
  it('合法标识符使用点号语法', () => {
    expect(pathSegmentForKey('name')).toBe('.name');
    expect(pathSegmentForKey('_private')).toBe('._private');
    expect(pathSegmentForKey('$id')).toBe('.$id');
  });

  it('特殊字符使用方括号语法', () => {
    expect(pathSegmentForKey('with space')).toBe('["with space"]');
    expect(pathSegmentForKey('a-b')).toBe('["a-b"]');
    expect(pathSegmentForKey('中文')).toBe('["中文"]');
  });
});

describe('buildTree', () => {
  it('构建正确的层级关系', () => {
    const model = buildTree(parseOk('{"a":{"b":1},"c":[10,20]}'));
    expect(model.rootId).toBe('n0');
    expect(model.nodes).toHaveLength(6); // root, a, b, c, [0], [1]
    const byPath = new Map(model.nodes.map((n) => [n.path, n] as const));
    expect(byPath.get('$.a')?.depth).toBe(1);
    expect(byPath.get('$.a.b')?.depth).toBe(2);
    expect(byPath.get('$.c[0]')?.index).toBe(0);
    expect(byPath.get('$.c[1]')?.parentId).toBe(byPath.get('$.c')?.id);
  });

  it('标记容器节点', () => {
    const model = buildTree(parseOk('{"a":{"b":1},"c":[]}'));
    const byPath = new Map(model.nodes.map((n) => [n.path, n] as const));
    expect(byPath.get('$.a')?.hasChildren).toBe(true);
    expect(byPath.get('$.a.b')?.hasChildren).toBe(false);
    expect(byPath.get('$.c')?.hasChildren).toBe(false);
    expect(byPath.get('$.c')?.childCount).toBe(0);
  });

  it('保留对象键顺序', () => {
    const model = buildTree(parseOk('{"z":1,"a":2}'));
    const keys = model.nodes.filter((n) => n.key !== null).map((n) => n.key);
    expect(keys).toEqual(['z', 'a']);
  });
});

describe('applySearch', () => {
  it('匹配键名', () => {
    const model = buildTree(parseOk('{"alpha":1,"beta":2}'));
    applySearch(model, 'alph');
    expect(model.matchedIds.size).toBe(1);
    const matched = model.nodes.find((n) => n.matched);
    expect(matched?.key).toBe('alpha');
  });

  it('匹配字符串值（大小写不敏感）', () => {
    const model = buildTree(parseOk('{"a":"Hello World"}'));
    applySearch(model, 'world');
    expect(model.matchedIds.size).toBe(1);
  });

  it('空查询清除所有匹配', () => {
    const model = buildTree(parseOk('{"a":1}'));
    applySearch(model, 'a');
    expect(model.matchedIds.size).toBeGreaterThan(0);
    applySearch(model, '  ');
    expect(model.matchedIds.size).toBe(0);
  });

  it('记录匹配节点的祖先', () => {
    const model = buildTree(parseOk('{"a":{"b":{"c":1}}}'));
    applySearch(model, 'c');
    expect(model.ancestorIds.size).toBeGreaterThan(0);
  });
});
