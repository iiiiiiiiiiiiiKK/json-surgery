/**
 * Serialisation helpers: pretty-printing, minifying and key sorting.
 *
 * The pretty printer works on the AST so that the original key order and the
 * original numeric literals survive a format operation.
 */

import type { JsonValue } from './ast';

export interface FormatOptions {
  /** Number of spaces per indentation level. Default 2. */
  indent?: number;
  /** Sort object keys alphabetically. Default false — never changes semantics silently. */
  sortKeys?: boolean;
  /** Preserve the original numeric literal (e.g. `1.50` stays `1.50`). Default true. */
  preserveNumberRaw?: boolean;
}

export function formatJson(value: JsonValue, options: FormatOptions = {}): string {
  const indent = Math.max(0, Math.min(8, options.indent ?? 2));
  const sortKeys = options.sortKeys ?? false;
  const preserveRaw = options.preserveNumberRaw ?? true;
  const pad = ' '.repeat(indent);

  const write = (node: JsonValue, depth: number): string => {
    switch (node.type) {
      case 'object': {
        if (node.entries.length === 0) return '{}';
        const entries = sortKeys
          ? [...node.entries].sort((a, b) => compareKeys(a.key, b.key))
          : node.entries;
        const inner = entries
          .map(
            (entry) =>
              `${pad.repeat(depth + 1)}${JSON.stringify(entry.key)}: ${write(entry.value, depth + 1)}`,
          )
          .join(',\n');
        return `{\n${inner}\n${pad.repeat(depth)}}`;
      }
      case 'array': {
        if (node.items.length === 0) return '[]';
        const inner = node.items.map((item) => `${pad.repeat(depth + 1)}${write(item, depth + 1)}`).join(',\n');
        return `[\n${inner}\n${pad.repeat(depth)}]`;
      }
      case 'string':
        return JSON.stringify(node.value);
      case 'number':
        return preserveRaw ? node.raw : String(node.value);
      case 'boolean':
        return node.value ? 'true' : 'false';
      case 'null':
        return 'null';
    }
  };

  return write(value, 0);
}

export function minifyJson(value: JsonValue): string {
  const parts: string[] = [];
  const write = (node: JsonValue): void => {
    switch (node.type) {
      case 'object': {
        parts.push('{');
        node.entries.forEach((entry, index) => {
          if (index > 0) parts.push(',');
          parts.push(JSON.stringify(entry.key));
          parts.push(':');
          write(entry.value);
        });
        parts.push('}');
        return;
      }
      case 'array': {
        parts.push('[');
        node.items.forEach((item, index) => {
          if (index > 0) parts.push(',');
          write(item);
        });
        parts.push(']');
        return;
      }
      case 'string':
        parts.push(JSON.stringify(node.value));
        return;
      case 'number':
        parts.push(node.raw);
        return;
      case 'boolean':
        parts.push(node.value ? 'true' : 'false');
        return;
      case 'null':
        parts.push('null');
        return;
    }
  };
  write(value);
  return parts.join('');
}

/**
 * Natural-ish key comparison: numeric segments compare numerically so that
 * "item2" sorts before "item10".
 */
export function compareKeys(a: string, b: string): number {
  const tokenize = (input: string): Array<string | number> =>
    (input.match(/(\d+|\D+)/g) ?? [input]).map((part) =>
      /^\d+$/.test(part) ? Number(part) : part.toLowerCase(),
    );

  const ax = tokenize(a);
  const bx = tokenize(b);
  const len = Math.min(ax.length, bx.length);

  for (let i = 0; i < len; i += 1) {
    const an = ax[i]!;
    const bn = bx[i]!;
    if (typeof an === 'number' && typeof bn === 'number') {
      if (an !== bn) return an - bn;
      continue;
    }
    if (typeof an === 'number' && typeof bn === 'string') {
      // Numbers sort before plain words.
      return -1;
    }
    if (typeof an === 'string' && typeof bn === 'number') {
      return 1;
    }
    const cmp = String(an).localeCompare(String(bn), 'en');
    if (cmp !== 0) return cmp;
  }
  return ax.length - bx.length;
}

/**
 * Produce a new AST with object keys sorted recursively.
 * Array order is preserved (changing it would change the data).
 */
export function sortKeysDeep(value: JsonValue): JsonValue {
  switch (value.type) {
    case 'object':
      return {
        type: 'object',
        entries: [...value.entries]
          .sort((a, b) => compareKeys(a.key, b.key))
          .map((entry) => ({ key: entry.key, value: sortKeysDeep(entry.value) })),
      };
    case 'array':
      return { type: 'array', items: value.items.map(sortKeysDeep) };
    default:
      return value;
  }
}

/** Human readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Human readable character count. */
export function formatCount(count: number): string {
  return count.toLocaleString('zh-CN');
}
