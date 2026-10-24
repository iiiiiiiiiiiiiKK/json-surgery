/**
 * JSONPath querying.
 *
 * The query engine is built on top of `jsonpath-plus` (MIT), which implements
 * the JSONPath Plus dialect (a superset of the classic JSONPath grammar).
 * The result is always reported together with the concrete path of every hit
 * so the user can see *where* the value came from.
 */

import { JSONPath } from 'jsonpath-plus';
import type { JsonValue } from './ast';
import { toPlain } from './ast';

export interface QueryHit {
  /** Path of the hit in the *result* dialect: `$['store']['book'][0]['title']`. */
  path: string;
  /** RFC 6901 JSON pointer, e.g. `/store/book/0/title`. */
  pointer: string;
  value: unknown;
  /** Pretty printed JSON of the hit. */
  json: string;
}

export interface QueryResult {
  ok: boolean;
  hits: QueryHit[];
  count: number;
  error?: string;
  /** The query that was executed (normalised). */
  query: string;
  elapsedMs: number;
}

export interface QueryOptions {
  /** Maximum number of hits returned. Default 500. */
  limit?: number;
}

/** Normalise a user typed expression into a JSONPath expression. */
export function normalizeQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('$')) return trimmed;
  if (trimmed.startsWith('[')) return `$${trimmed}`;
  if (trimmed.startsWith('.')) return `$${trimmed}`;
  return `$.${trimmed}`;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Light-weight syntax pre-check.
 *
 * `jsonpath-plus` is lenient and silently accepts some malformed expressions
 * (e.g. `$.a[`), which would confuse users. This check reports obviously
 * broken input with a readable message before the query is executed.
 */
export function validateQueryExpression(raw: string): string | null {
  const query = normalizeQuery(raw);
  if (!query) return '请输入 JSONPath 表达式，例如 $.store.book[*].title';

  let depthSquare = 0;
  let depthRound = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < query.length; i += 1) {
    const ch = query[i]!;
    if (inDoubleQuote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '"') inDoubleQuote = false;
      continue;
    }
    if (inSingleQuote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      continue;
    }
    if (ch === '[') depthSquare += 1;
    else if (ch === ']') depthSquare -= 1;
    else if (ch === '(') depthRound += 1;
    else if (ch === ')') depthRound -= 1;

    if (depthSquare < 0) return '方括号不匹配：多余的 “]”。';
    if (depthRound < 0) return '圆括号不匹配：多余的 “)”。';
  }

  if (inDoubleQuote || inSingleQuote) return '引号没有闭合。';
  if (depthSquare > 0) return '方括号没有闭合：缺少 “]”。';
  if (depthRound > 0) return '圆括号没有闭合：缺少 “)”。';

  if (/\[\s*$/.test(query)) return '数组下标不完整：请补全 “]”。';
  if (/\[\?\s*$/.test(query)) return '过滤表达式不完整：请补全 “@.字段” 与 “]”。';
  if (/\(\s*$/.test(query)) return '过滤表达式不完整：括号没有闭合。';

  return null;
}

/**
 * Run a JSONPath query against a parsed document.
 * Never throws — errors are returned as part of the result.
 */
export function runQuery(root: JsonValue, rawQuery: string, options: QueryOptions = {}): QueryResult {
  const query = normalizeQuery(rawQuery);
  const limit = options.limit ?? 500;
  const started = Date.now();

  const syntaxError = validateQueryExpression(rawQuery);
  if (syntaxError) {
    return { ok: false, hits: [], count: 0, error: syntaxError, query, elapsedMs: Date.now() - started };
  }

  try {
    const plain = toPlain(root);
    const raw = JSONPath({
      path: query,
      json: plain as object,
      resultType: 'all',
    }) as Array<{ path: string; value: unknown; pointer?: string }>;

    const hits: QueryHit[] = [];
    for (const item of raw) {
      if (hits.length >= limit) break;
      hits.push({
        path: item.path,
        pointer: item.pointer ?? '',
        value: item.value,
        json: stringify(item.value),
      });
    }

    return {
      ok: true,
      hits,
      count: hits.length,
      error: undefined,
      query,
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      hits: [],
      count: 0,
      error: error instanceof Error ? error.message : String(error),
      query,
      elapsedMs: Date.now() - started,
    };
  }
}

/** Example expressions shipped with the UI. */
export const QUERY_EXAMPLES: Array<{ label: string; expression: string; hint: string }> = [
  { label: '所有书名', expression: '$.store.book[*].title', hint: '通配符 + 数组下标' },
  { label: '递归查找 title', expression: '$..title', hint: '递归下降' },
  { label: '第一个元素', expression: '$.store.book[0]', hint: '数组索引' },
  { label: '颜色字段', expression: '$.store.bicycle.color', hint: '对象成员访问' },
  { label: '所有价格大于 10', expression: '$.store.book[?(@.price>10)]', hint: '过滤表达式' },
  { label: '所有键名', expression: '$..*', hint: '匹配全部后代' },
];

export interface QueryExample {
  label: string;
  expression: string;
  hint: string;
}
