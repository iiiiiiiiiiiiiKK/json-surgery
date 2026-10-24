/**
 * Message protocol between the UI and the JSON engine worker.
 * The worker owns parsing so that the main thread never blocks on huge files.
 */

import type { JsonStats } from './stats';
import type { DiffResult } from './diff';
import type { QueryResult } from './query';
import type { JsonValue } from './ast';
import type { ParseWarning } from './parser';

export interface SerializedTreeNode {
  id: string;
  path: string;
  key: string | null;
  index: number | null;
  parentId: string | null;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  preview: string;
  type: string;
  /** Raw value for scalars, `null` for containers. */
  scalar: string | number | boolean | null;
  /** True for containers (object/array). */
  isContainer: boolean;
}

export interface AnalyzeResponse {
  id: number;
  type: 'analyze';
  ok: boolean;
  /** Present when parsing succeeded. */
  stats?: JsonStats;
  /** Non-fatal remarks (e.g. integers beyond 2^53). */
  warnings?: ParseWarning[];
  nodes?: SerializedTreeNode[];
  rootId?: string;
  /** True when the tree was cut off at `nodeLimit` to keep the UI responsive. */
  truncated?: boolean;
  nodeLimit?: number;
  error?: {
    message: string;
    code: string;
    line: number;
    column: number;
    offset: number;
  };
  /** Number of characters processed. */
  length?: number;
  elapsedMs?: number;
}

export interface FormatResponse {
  id: number;
  type: 'format';
  ok: boolean;
  text?: string;
  error?: string;
  elapsedMs: number;
}

export interface QueryResponse {
  id: number;
  type: 'query';
  result: QueryResult;
}

export interface DiffResponse {
  id: number;
  type: 'diff';
  result: DiffResult | null;
  error?: string;
  leftError?: { message: string; line: number; column: number };
  rightError?: { message: string; line: number; column: number };
}

export interface WorkerRequest {
  id: number;
  type: 'analyze' | 'format' | 'query' | 'diff' | 'sort';
  text?: string;
  rightText?: string;
  indent?: number;
  sortKeys?: boolean;
  query?: string;
  mode?: 'pretty' | 'minify' | 'sort';
}

export type WorkerResponse =
  | AnalyzeResponse
  | FormatResponse
  | QueryResponse
  | DiffResponse;

export type { JsonValue };
