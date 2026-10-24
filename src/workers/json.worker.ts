/**
 * JSON engine worker.
 *
 * All parsing, formatting, statistics, diffing and querying happens here so the
 * UI thread stays responsive even for multi-megabyte documents.
 * Nothing in this worker performs network access — the data never leaves the browser.
 */

/// <reference lib="webworker" />

import { analyzeText, diffText, formatText, queryText } from '../lib/engine';
import type { WorkerRequest, WorkerResponse } from '../lib/protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  let response: WorkerResponse;

  switch (request.type) {
    case 'analyze':
      response = { ...analyzeText(request.text ?? ''), id: request.id };
      break;
    case 'format':
      response = { id: request.id, type: 'format', ...formatText(request.text ?? '', request.mode ?? 'pretty', request.indent ?? 2, request.sortKeys ?? false) };
      break;
    case 'query':
      response = { id: request.id, type: 'query', result: queryText(request.text ?? '', request.query ?? '') };
      break;
    case 'diff':
      response = { id: request.id, type: 'diff', ...diffText(request.text ?? '', request.rightText ?? '') };
      break;
    case 'sort':
      response = {
        id: request.id,
        type: 'format',
        ...formatText(request.text ?? '', 'sort', request.indent ?? 2, request.sortKeys ?? true),
      };
      break;
    default:
      response = {
        id: request.id,
        type: 'format',
        ok: false,
        error: `未知任务类型：${(request as { type: string }).type}`,
        elapsedMs: 0,
      };
  }

  ctx.postMessage(response);
});
