import { describe, expect, it } from 'vitest';
import { normalizeQuery, runQuery } from '../lib/query';
import { parseJson } from '../lib/parser';

function parseOk(text: string) {
  const result = parseJson(text);
  if (!result.ok) throw new Error(`解析失败: ${result.error.message}`);
  return result.value;
}

const STORE = `{
  "store": {
    "book": [
      { "category": "reference", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "title": "Sword of Honour", "price": 12.99 }
    ],
    "bicycle": { "color": "red", "price": 19.95 }
  }
}`;

describe('normalizeQuery', () => {
  it('补全缺失的根符号', () => {
    expect(normalizeQuery('store.book')).toBe('$.store.book');
    expect(normalizeQuery('$.store.book')).toBe('$.store.book');
    expect(normalizeQuery('.store.book')).toBe('$.store.book');
    expect(normalizeQuery('[0]')).toBe('$[0]');
  });

  it('空查询返回空字符串', () => {
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('runQuery', () => {
  it('查询所有书名', () => {
    const result = runQuery(parseOk(STORE), '$.store.book[*].title');
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.hits[0]?.value).toBe('Sayings of the Century');
    expect(result.hits[1]?.value).toBe('Sword of Honour');
  });

  it('查询单个对象', () => {
    const result = runQuery(parseOk(STORE), '$.store.bicycle');
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect((result.hits[0]?.value as { color: string }).color).toBe('red');
  });

  it('递归下降查找', () => {
    const result = runQuery(parseOk(STORE), '$..title');
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
  });

  it('过滤表达式', () => {
    const result = runQuery(parseOk(STORE), '$.store.book[?(@.price>10)]');
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
  });

  it('返回命中路径', () => {
    const result = runQuery(parseOk(STORE), '$.store.book[0].title');
    expect(result.ok).toBe(true);
    expect(result.hits[0]?.path).toContain('title');
    expect(result.hits[0]?.pointer).toBe('/store/book/0/title');
  });

  it('限制返回数量', () => {
    const result = runQuery(parseOk(STORE), '$.store.book[*]', { limit: 1 });
    expect(result.count).toBe(1);
  });

  it('空查询返回错误而不是抛出异常', () => {
    const result = runQuery(parseOk(STORE), '');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('非法表达式返回错误而不是抛出异常', () => {
    const result = runQuery(parseOk(STORE), '$.store.book[?(@.price>)]');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('没有匹配时返回 0 条', () => {
    const result = runQuery(parseOk(STORE), '$.does.not.exist');
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
  });

  it('查询包含 Unicode 的值', () => {
    const result = runQuery(parseOk('{"a":{"b":"中文"}}'), '$.a.b');
    expect(result.ok).toBe(true);
    expect(result.hits[0]?.value).toBe('中文');
  });

  it('查询 null 值', () => {
    const result = runQuery(parseOk('{"a":null}'), '$.a');
    expect(result.ok).toBe(true);
    expect(result.hits[0]?.value).toBe(null);
  });
});
