/**
 * JSON AST types.
 *
 * The AST keeps *exact* source order of object keys and the original numeric
 * literal text. JavaScript objects cannot represent both reliably (integer-like
 * keys are re-ordered by the engine, and `1` vs `1.0` vs `1e0` collapse), so we
 * keep our own tree and derive plain JS values only where needed (JSONPath).
 */

export interface JsonObject {
  type: 'object';
  entries: JsonEntry[];
}

export interface JsonEntry {
  key: string;
  value: JsonValue;
}

export interface JsonArray {
  type: 'array';
  items: JsonValue[];
}

export interface JsonString {
  type: 'string';
  value: string;
}

export interface JsonNumber {
  type: 'number';
  value: number;
  /** Original literal text, e.g. `1.50`, `1e3`, `-0`. */
  raw: string;
}

export interface JsonBoolean {
  type: 'boolean';
  value: boolean;
}

export interface JsonNull {
  type: 'null';
}

export type JsonValue =
  | JsonObject
  | JsonArray
  | JsonString
  | JsonNumber
  | JsonBoolean
  | JsonNull;

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export function jsonType(value: JsonValue): JsonNodeType {
  return value.type;
}

export function isContainer(value: JsonValue): value is JsonObject | JsonArray {
  return value.type === 'object' || value.type === 'array';
}

export function childCount(value: JsonValue): number {
  if (value.type === 'object') return value.entries.length;
  if (value.type === 'array') return value.items.length;
  return 0;
}

/** Children of a container node, in source order. */
export function childrenOf(value: JsonValue): JsonValue[] {
  if (value.type === 'object') return value.entries.map((entry) => entry.value);
  if (value.type === 'array') return value.items;
  return [];
}

/** Keys of an object node, in source order. */
export function keysOf(value: JsonValue): string[] {
  if (value.type !== 'object') return [];
  return value.entries.map((entry) => entry.key);
}

/**
 * Short, human readable preview of a node.
 * Objects/arrays are summarised instead of being expanded.
 */
export function previewOf(value: JsonValue, maxLength = 80): string {
  switch (value.type) {
    case 'object': {
      const n = value.entries.length;
      if (n === 0) return '{}';
      return `{ … } ${n} ${n === 1 ? 'key' : 'keys'}`;
    }
    case 'array': {
      const n = value.items.length;
      if (n === 0) return '[]';
      return `[ … ] ${n} ${n === 1 ? 'item' : 'items'}`;
    }
    case 'string': {
      const quoted = JSON.stringify(value.value);
      return quoted.length > maxLength ? `${quoted.slice(0, maxLength - 1)}…"` : quoted;
    }
    case 'number':
      return value.raw;
    case 'boolean':
      return value.value ? 'true' : 'false';
    case 'null':
      return 'null';
  }
}

/** Compact single-line JSON representation of a node (used in the diff view). */
export function compactOf(value: JsonValue, maxLength = 160): string {
  if (value.type === 'object' || value.type === 'array') return previewOf(value);
  const text = previewOf(value, maxLength);
  return text;
}

/** Convert the AST into plain JavaScript values (used for JSONPath evaluation). */
export function toPlain(value: JsonValue): unknown {
  switch (value.type) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const entry of value.entries) out[entry.key] = toPlain(entry.value);
      return out;
    }
    case 'array':
      return value.items.map(toPlain);
    case 'string':
      return value.value;
    case 'number':
      return value.value;
    case 'boolean':
      return value.value;
    case 'null':
      return null;
  }
}

/** Build an AST from plain JavaScript values (used for test fixtures). */
export function fromPlain(input: unknown): JsonValue {
  if (input === null) return { type: 'null' };
  if (Array.isArray(input)) return { type: 'array', items: input.map(fromPlain) };
  const kind = typeof input;
  if (kind === 'string') return { type: 'string', value: input as string };
  if (kind === 'number') return { type: 'number', value: input as number, raw: String(input) };
  if (kind === 'boolean') return { type: 'boolean', value: input as boolean };
  if (kind === 'object') {
    const entries: JsonEntry[] = [];
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      entries.push({ key, value: fromPlain(value) });
    }
    return { type: 'object', entries };
  }
  throw new TypeError(`Unsupported value type: ${kind}`);
}

/** Structural deep clone of an AST node. */
export function cloneValue(value: JsonValue): JsonValue {
  switch (value.type) {
    case 'object':
      return { type: 'object', entries: value.entries.map((e) => ({ key: e.key, value: cloneValue(e.value) })) };
    case 'array':
      return { type: 'array', items: value.items.map(cloneValue) };
    case 'string':
      return { ...value };
    case 'number':
      return { ...value };
    case 'boolean':
      return { ...value };
    case 'null':
      return { ...value };
  }
}

/** True when both nodes are structurally equal (numbers compared numerically). */
export function valuesEqual(a: JsonValue, b: JsonValue): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'object': {
      if (b.type !== 'object') return false;
      if (a.entries.length !== b.entries.length) return false;
      const bMap = new Map(b.entries.map((e) => [e.key, e.value] as const));
      for (const entry of a.entries) {
        const other = bMap.get(entry.key);
        if (other === undefined) return false;
        if (!valuesEqual(entry.value, other)) return false;
      }
      return true;
    }
    case 'array': {
      if (b.type !== 'array') return false;
      if (a.items.length !== b.items.length) return false;
      return a.items.every((item, i) => valuesEqual(item, b.items[i]!));
    }
    case 'string':
      return a.value === (b as JsonString).value;
    case 'number':
      return a.value === (b as JsonNumber).value;
    case 'boolean':
      return a.value === (b as JsonBoolean).value;
    case 'null':
      return true;
  }
}
