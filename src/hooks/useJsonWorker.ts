import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkerRequest, WorkerResponse } from '../lib/protocol';

type Pending = {
  resolve: (response: WorkerResponse | null) => void;
  timer: number;
};

/** How long a worker job may run before the UI falls back to the main thread. */
const WORKER_TIMEOUT_MS = 30000;

/**
 * Thin promise wrapper around the JSON engine worker.
 *
 * Resolves `null` when Workers are unavailable or a job times out; the caller
 * then runs the exact same engine functions on the main thread. That keeps the
 * app working everywhere (including `file://` previews) while still preferring
 * the worker, which is what keeps the UI responsive on multi-megabyte files.
 */
export function useJsonWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, Pending>>(new Map());
  const counterRef = useRef(0);
  const [state, setState] = useState<'starting' | 'ready' | 'unavailable'>('starting');

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setState('unavailable');
      return;
    }
    let worker: Worker;
    const pending = pendingRef.current;
    try {
      worker = new Worker(new URL('../workers/json.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setState('unavailable');
      return;
    }
    workerRef.current = worker;
    setState('ready');

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      window.clearTimeout(entry.timer);
      entry.resolve(response);
    };
    worker.onerror = () => {
      // A crashed worker must not block the app; the sync fallback takes over.
      pending.forEach((entry) => {
        window.clearTimeout(entry.timer);
        entry.resolve(null);
      });
      pending.clear();
      setState('unavailable');
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.forEach((entry) => {
        window.clearTimeout(entry.timer);
        entry.resolve(null);
      });
      pending.clear();
    };
  }, []);

  const request = useCallback((payload: Omit<WorkerRequest, 'id'>): Promise<WorkerResponse | null> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve(null);
    counterRef.current += 1;
    const id = counterRef.current;
    return new Promise<WorkerResponse | null>((resolve) => {
      const timer = window.setTimeout(() => {
        pendingRef.current.delete(id);
        resolve(null);
      }, WORKER_TIMEOUT_MS);
      pendingRef.current.set(id, { resolve, timer });
      try {
        worker.postMessage({ ...payload, id } satisfies WorkerRequest);
      } catch {
        pendingRef.current.delete(id);
        window.clearTimeout(timer);
        resolve(null);
      }
    });
  }, []);

  return { request, state };
}
