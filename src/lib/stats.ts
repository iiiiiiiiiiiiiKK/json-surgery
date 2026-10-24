/**
 * Structural statistics for a JSON document.
 *
 * Counts every value by type plus the maximum nesting depth, the number of
 * object keys and the total number of nodes.
 */

import type { JsonValue } from './ast';

export interface JsonStats {
  objects: number;
  arrays: number;
  keys: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  /** Maximum nesting depth. The root value has depth 1. */
  maxDepth: number;
  /** Total number of nodes (values), including the root. */
  totalNodes: number;
  /** Number of leaf (scalar) values. */
  leaves: number;
}

export const EMPTY_STATS: JsonStats = {
  objects: 0,
  arrays: 0,
  keys: 0,
  strings: 0,
  numbers: 0,
  booleans: 0,
  nulls: 0,
  maxDepth: 0,
  totalNodes: 0,
  leaves: 0,
};

/**
 * Compute statistics iteratively so that deeply nested documents cannot blow
 * the JavaScript call stack.
 */
export function computeStats(root: JsonValue): JsonStats {
  const stats: JsonStats = { ...EMPTY_STATS };
  const stack: Array<{ node: JsonValue; depth: number }> = [{ node: root, depth: 1 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    stats.totalNodes += 1;
    if (depth > stats.maxDepth) stats.maxDepth = depth;

    switch (node.type) {
      case 'object':
        stats.objects += 1;
        stats.keys += node.entries.length;
        for (const entry of node.entries) {
          stack.push({ node: entry.value, depth: depth + 1 });
        }
        break;
      case 'array':
        stats.arrays += 1;
        for (const item of node.items) {
          stack.push({ node: item, depth: depth + 1 });
        }
        break;
      case 'string':
        stats.strings += 1;
        stats.leaves += 1;
        break;
      case 'number':
        stats.numbers += 1;
        stats.leaves += 1;
        break;
      case 'boolean':
        stats.booleans += 1;
        stats.leaves += 1;
        break;
      case 'null':
        stats.nulls += 1;
        stats.leaves += 1;
        break;
    }
  }

  return stats;
}
