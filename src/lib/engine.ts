/**
 * The JSON engine.
 *
 * Every operation the UI needs is expressed here so that the exact same code
 * can run inside a Web Worker (preferred) or on the main thread (fallback for
 * environments where Workers are unavailable).
 *
 * No function in this module performs any network or storage access.
 */

import { parseJson } from './parser';
import { formatJson, minifyJson, sortKeysDeep } from './format';
import { computeStats } from './stats';
import { buildTree } from './tree';
import { diffJson } from './diff';
import { runQuery } from './query';
import type { AnalyzeResponse, SerializedTreeNode } from './protocol';
import type { JsonValue } from './ast';

/**
 * Maximum number of tree rows sent to the UI.
 *
 * The tree panel renders one row per node; beyond this the DOM (not the parser)
 * becomes the bottleneck. The documents themselves are still fully parsed and
 * counted, so statistics stay accurate — only the interactive tree is capped,
 * and the UI says so explicitly instead of silently hiding data.
 */
export const NODE_LIMIT = 20000;

function serializeTree(root: JsonValue): { nodes: SerializedTreeNode[]; truncated: boolean } {
  const model = buildTree(root, NODE_LIMIT);
  const nodes = model.nodes.map((node) => {
    const value = node.value;
    const isContainer = value.type === 'object' || value.type === 'array';
    let scalar: string | number | boolean | null = null;
    if (value.type === 'string') scalar = value.value;
    else if (value.type === 'number') scalar = value.value;
    else if (value.type === 'boolean') scalar = value.value;
    return {
      id: node.id,
      path: node.path,
      key: node.key,
      index: node.index,
      parentId: node.parentId,
      depth: node.depth,
      childCount: node.childCount,
      hasChildren: node.hasChildren,
      preview: node.preview,
      type: value.type,
      scalar,
      isContainer,
    } satisfies SerializedTreeNode;
  });
  return { nodes, truncated: model.truncated };
}

/** Parse + compute statistics + build the tree model. */
export function analyzeText(text: string): AnalyzeResponse {
  const started = Date.now();
  const result = parseJson(text);
  if (!result.ok) {
    return {
      id: 0,
      type: 'analyze',
      ok: false,
      error: {
        message: result.error.message,
        code: result.error.code,
        line: result.error.line,
        column: result.error.column,
        offset: result.error.offset,
      },
      length: text.length,
      elapsedMs: Date.now() - started,
    };
  }
  const tree = serializeTree(result.value);
  return {
    id: 0,
    type: 'analyze',
    ok: true,
    stats: computeStats(result.value),
    warnings: result.warnings,
    nodes: tree.nodes,
    rootId: tree.nodes[0]?.id ?? 'n0',
    truncated: tree.truncated,
    nodeLimit: NODE_LIMIT,
    length: text.length,
    elapsedMs: Date.now() - started,
  };
}

/** Format / minify / sort a document. */
export function formatText(
  text: string,
  mode: 'pretty' | 'minify' | 'sort',
  indent = 2,
  sortKeys = false,
): { ok: boolean; text?: string; error?: string; elapsedMs: number } {
  const started = Date.now();
  const result = parseJson(text);
  if (!result.ok) {
    return { ok: false, error: result.error.message, elapsedMs: Date.now() - started };
  }
  let output: string;
  if (mode === 'minify') {
    output = minifyJson(result.value);
  } else if (mode === 'sort') {
    output = formatJson(sortKeysDeep(result.value), { indent });
  } else {
    output = formatJson(result.value, { indent, sortKeys });
  }
  return { ok: true, text: output, elapsedMs: Date.now() - started };
}

/** Run a JSONPath query against a document. */
export function queryText(text: string, query: string) {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return {
      ok: false,
      hits: [],
      count: 0,
      error: `JSON 解析失败，无法执行查询：${parsed.error.message}`,
      query,
      elapsedMs: 0,
    };
  }
  return runQuery(parsed.value, query);
}

/** Diff two documents. */
export function diffText(leftText: string, rightText: string) {
  const left = parseJson(leftText);
  const right = parseJson(rightText);
  if (!left.ok) {
    return {
      result: null,
      error: `左侧 JSON 无效：${left.error.message}`,
      leftError: { message: left.error.message, line: left.error.line, column: left.error.column },
      rightError: undefined,
    };
  }
  if (!right.ok) {
    return {
      result: null,
      error: `右侧 JSON 无效：${right.error.message}`,
      leftError: undefined,
      rightError: { message: right.error.message, line: right.error.line, column: right.error.column },
    };
  }
  return { result: diffJson(left.value, right.value), error: undefined, leftError: undefined, rightError: undefined };
}
