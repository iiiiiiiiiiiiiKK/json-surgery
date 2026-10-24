/**
 * Structural diff between two JSON documents.
 *
 * The diff is computed on the AST, so it is aware of the exact structure of
 * the documents and can report precise JSONPath locations for every change.
 */

import type { JsonValue } from './ast';
import { previewOf, valuesEqual } from './ast';
import { pathSegmentForKey } from './tree';

export type DiffKind = 'added' | 'removed' | 'changed' | 'type-changed';

export interface DiffEntry {
  kind: DiffKind;
  /** JSONPath of the change. */
  path: string;
  /** Value before the change (`null` for additions). */
  before: JsonValue | null;
  /** Value after the change (`null` for removals). */
  after: JsonValue | null;
  /** Short human readable summary. */
  summary: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  typeChanged: number;
  total: number;
  identical: boolean;
}

export interface DiffResult {
  entries: DiffEntry[];
  summary: DiffSummary;
}

function typeName(value: JsonValue): string {
  switch (value.type) {
    case 'object':
      return 'object';
    case 'array':
      return 'array';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
  }
}

/**
 * Compare two ASTs and produce a flat list of changes.
 * Recursion is bounded by the document depth (the parser already caps it).
 */
export function diffJson(left: JsonValue, right: JsonValue): DiffResult {
  const entries: DiffEntry[] = [];

  const walk = (a: JsonValue, b: JsonValue, path: string): void => {
    if (a.type !== b.type) {
      entries.push({
        kind: 'type-changed',
        path,
        before: a,
        after: b,
        summary: `类型从 ${typeName(a)} 变为 ${typeName(b)}`,
      });
      return;
    }

    switch (a.type) {
      case 'object': {
        if (b.type !== 'object') return;
        const bMap = new Map(b.entries.map((e) => [e.key, e.value] as const));
        const aMap = new Map(a.entries.map((e) => [e.key, e.value] as const));
        for (const entry of a.entries) {
          const childPath = `${path}${pathSegmentForKey(entry.key)}`;
          const other = bMap.get(entry.key);
          if (other === undefined) {
            entries.push({
              kind: 'removed',
              path: childPath,
              before: entry.value,
              after: null,
              summary: `删除了键 “${entry.key}”`,
            });
          } else {
            walk(entry.value, other, childPath);
          }
        }
        for (const entry of b.entries) {
          if (!aMap.has(entry.key)) {
            const childPath = `${path}${pathSegmentForKey(entry.key)}`;
            entries.push({
              kind: 'added',
              path: childPath,
              before: null,
              after: entry.value,
              summary: `新增了键 “${entry.key}”`,
            });
          }
        }
        return;
      }
      case 'array': {
        if (b.type !== 'array') return;
        const common = Math.min(a.items.length, b.items.length);
        for (let i = 0; i < common; i += 1) {
          walk(a.items[i]!, b.items[i]!, `${path}[${i}]`);
        }
        for (let i = common; i < a.items.length; i += 1) {
          entries.push({
            kind: 'removed',
            path: `${path}[${i}]`,
            before: a.items[i]!,
            after: null,
            summary: `删除了第 ${i + 1} 个元素`,
          });
        }
        for (let i = common; i < b.items.length; i += 1) {
          entries.push({
            kind: 'added',
            path: `${path}[${i}]`,
            before: null,
            after: b.items[i]!,
            summary: `新增了第 ${i + 1} 个元素`,
          });
        }
        return;
      }
      default: {
        if (!valuesEqual(a, b)) {
          entries.push({
            kind: 'changed',
            path,
            before: a,
            after: b,
            summary: `${previewOf(a, 40)} → ${previewOf(b, 40)}`,
          });
        }
        return;
      }
    }
  };

  walk(left, right, '$');

  const summary: DiffSummary = {
    added: entries.filter((e) => e.kind === 'added').length,
    removed: entries.filter((e) => e.kind === 'removed').length,
    changed: entries.filter((e) => e.kind === 'changed').length,
    typeChanged: entries.filter((e) => e.kind === 'type-changed').length,
    total: entries.length,
    identical: entries.length === 0,
  };

  return { entries, summary };
}
