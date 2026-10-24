/**
 * Tree model for the JSON viewer.
 *
 * The tree is built once per document into a flat array of nodes with
 * pre-computed depth, path and parent relations. This keeps rendering fast
 * (only visible rows are rendered) and makes search / expand-all trivial.
 */

import type { JsonValue } from './ast';
import { previewOf } from './ast';

export interface TreeNode {
  id: string;
  /** JSONPath style path, e.g. `$.store.book[0].title`. */
  path: string;
  /** Key inside the parent object, or `null` for array items / root. */
  key: string | null;
  /** Index inside the parent array, or `null`. */
  index: number | null;
  parentId: string | null;
  depth: number;
  value: JsonValue;
  /** Number of children (0 for scalars). */
  childCount: number;
  /** True when this node is a container with at least one child. */
  hasChildren: boolean;
  /** Key of the child that first child would occupy (for expansion UI). */
  preview: string;
  /** True when the node matched the current search query. */
  matched: boolean;
}

export interface TreeModel {
  nodes: TreeNode[];
  rootId: string;
  /** True when `limit` cut the tree short (very large documents). */
  truncated: boolean;
  /** Ids of nodes matching the search query. */
  matchedIds: Set<string>;
  /** Ids of all ancestors of matched nodes (so they can be auto-expanded). */
  ancestorIds: Set<string>;
}

/** Build a JSONPath string segment for an object key. */
export function pathSegmentForKey(key: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `.${key}`;
  return `[${JSON.stringify(key)}]`;
}

/**
 * Flatten the AST into tree rows, in document order.
 *
 * `limit` caps how many rows are produced: rendering millions of DOM rows would
 * freeze the browser long before memory becomes a problem. Statistics are
 * computed separately from the AST, so a truncated tree never affects counts.
 */
export function buildTree(root: JsonValue, limit = Number.POSITIVE_INFINITY): TreeModel {
  const nodes: TreeNode[] = [];
  let counter = 0;
  let truncated = false;

  const walk = (node: JsonValue, path: string, key: string | null, index: number | null, parentId: string | null, depth: number): string => {
    const id = `n${counter++}`;
    const childCount = node.type === 'object' ? node.entries.length : node.type === 'array' ? node.items.length : 0;
    const treeNode: TreeNode = {
      id,
      path,
      key,
      index,
      parentId,
      depth,
      value: node,
      childCount,
      hasChildren: childCount > 0,
      preview: previewOf(node),
      matched: false,
    };
    nodes.push(treeNode);

    if (nodes.length >= limit) {
      truncated = true;
      return id;
    }

    if (node.type === 'object') {
      for (const entry of node.entries) {
        if (nodes.length >= limit) {
          truncated = true;
          break;
        }
        walk(entry.value, `${path}${pathSegmentForKey(entry.key)}`, entry.key, null, id, depth + 1);
      }
    } else if (node.type === 'array') {
      for (let i = 0; i < node.items.length; i += 1) {
        if (nodes.length >= limit) {
          truncated = true;
          break;
        }
        walk(node.items[i]!, `${path}[${i}]`, null, i, id, depth + 1);
      }
    }
    return id;
  };

  const rootId = walk(root, '$', null, null, null, 0);
  return { nodes, rootId, truncated, matchedIds: new Set(), ancestorIds: new Set() };
}

/**
 * Mark nodes whose key or scalar value contains the query.
 * Container matches only count for their own key, not their descendants.
 */
export function applySearch(model: TreeModel, query: string): TreeModel {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    for (const node of model.nodes) node.matched = false;
    model.matchedIds = new Set();
    model.ancestorIds = new Set();
    return model;
  }

  const matchedIds = new Set<string>();
  const ancestorIds = new Set<string>();
  const byId = new Map(model.nodes.map((n) => [n.id, n] as const));

  for (const node of model.nodes) {
    let hit = false;
    if (node.key && node.key.toLowerCase().includes(needle)) hit = true;
    if (!hit) {
      const value = node.value;
      if (value.type === 'string' && value.value.toLowerCase().includes(needle)) hit = true;
      else if (value.type === 'number' && String(value.raw).includes(needle)) hit = true;
      else if (value.type === 'boolean' && String(value.value).includes(needle)) hit = true;
      else if (value.type === 'null' && 'null'.includes(needle)) hit = true;
    }
    if (hit) {
      node.matched = true;
      matchedIds.add(node.id);
      let parentId = node.parentId;
      while (parentId) {
        ancestorIds.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    } else {
      node.matched = false;
    }
  }

  model.matchedIds = matchedIds;
  model.ancestorIds = ancestorIds;
  return model;
}

/** Collect the ids of every descendant of `nodeId` (used by expand/collapse). */
export function descendantIds(model: TreeModel, nodeId: string): string[] {
  const ids: string[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const node of model.nodes) {
      if (node.parentId === current) {
        ids.push(node.id);
        stack.push(node.id);
      }
    }
  }
  return ids;
}

/** Collect the ids of every ancestor of `nodeId`, closest first. */
export function ancestorIds(model: TreeModel, nodeId: string): string[] {
  const ids: string[] = [];
  const byId = new Map(model.nodes.map((n) => [n.id, n] as const));
  let parentId = byId.get(nodeId)?.parentId ?? null;
  while (parentId) {
    ids.push(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return ids;
}
