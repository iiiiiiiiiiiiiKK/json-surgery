import { describe, expect, it } from 'vitest';
import { parsePathTokens, samePath, toTreePath } from './paths';

describe('parsePathTokens', () => {
  it('解析点号路径', () => {
    expect(parsePathTokens('$.store.book')).toEqual(['store', 'book']);
  });

  it('解析方括号引号路径（jsonpath-plus 输出的形式）', () => {
    expect(parsePathTokens("$['store']['book'][0]['title']")).toEqual(['store', 'book', 0, 'title']);
  });

  it('解析数组索引与混合路径', () => {
    expect(parsePathTokens('$[0].a[12]')).toEqual([0, 'a', 12]);
  });

  it('解析含转义的键名', () => {
    expect(parsePathTokens('$["a\\"b"]')).toEqual(['a"b']);
    expect(parsePathTokens("$['it\\'s']")).toEqual(["it's"]);
  });

  it('拒绝非具体路径（通配符、递归、过滤）', () => {
    expect(parsePathTokens('$..title')).toBeNull();
    expect(parsePathTokens('$.book[*]')).toBeNull();
    expect(parsePathTokens('$.book[?(@.price>1)]')).toBeNull();
    expect(parsePathTokens('book')).toBeNull();
  });

  it('根路径解析为空 token 列表', () => {
    expect(parsePathTokens('$')).toEqual([]);
  });
});

describe('samePath', () => {
  it('跨书写风格认定同一节点', () => {
    expect(samePath("$['store']['book'][0]['title']", '$.store.book[0].title')).toBe(true);
    expect(samePath('$[0]', '$[0]')).toBe(true);
  });

  it('区分不同节点', () => {
    expect(samePath('$.a.b', '$.a.c')).toBe(false);
    expect(samePath('$.a', '$.a.b')).toBe(false);
    expect(samePath('[0]', '[1]')).toBe(false);
  });

  it('无法解析时返回 false 而不是抛错', () => {
    expect(samePath('$..a', '$.a')).toBe(false);
    expect(samePath('nonsense', '$')).toBe(false);
  });
});

describe('toTreePath', () => {
  it('把 bracket 写法转成树形写法', () => {
    expect(toTreePath("$['store']['book'][0]['title']")).toBe('$.store.book[0].title');
  });

  it('对含特殊字符的键使用方括号', () => {
    expect(toTreePath("$['a b']")).toBe('$["a b"]');
    expect(toTreePath("$['中文']")).toBe('$["中文"]');
  });

  it('非具体路径返回 null', () => {
    expect(toTreePath('$..a')).toBeNull();
  });
});
