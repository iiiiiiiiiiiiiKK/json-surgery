/**
 * JSONPath helpers for matching paths across dialects.
 *
 * Different tools print the same location differently:
 *  - the tree view uses dot/bracket notation: `$.store.book[0].title`
 *  - `jsonpath-plus` returns bracket-quoted notation: `$['store']['book'][0]['title']`
 *
 * To jump from a query hit to a tree row we normalise both into the same token
 * list and compare that, instead of comparing raw strings.
 */

export type PathToken = string | number;

/**
 * Parse a JSONPath-ish string into tokens.
 * Returns `null` when the string is not a simple path (filters, recursion, …),
 * in which case callers should not attempt an exact match.
 */
export function parsePathTokens(input: string): PathToken[] | null {
  const text = input.trim();
  if (!text.startsWith('$')) return null;
  const tokens: PathToken[] = [];
  let i = 1;

  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '.') {
      if (text[i + 1] === '.') return null; // recursive descent: not a concrete path
      i += 1;
      let name = '';
      while (i < text.length) {
        const c = text[i]!;
        if (c === '.' || c === '[') break;
        name += c;
        i += 1;
      }
      if (name === '') return null;
      tokens.push(name);
      continue;
    }
    if (ch === '[') {
      i += 1;
      let inner = '';
      let sawQuote = false;
      let quoted: '"' | "'" | null = null;
      while (i < text.length) {
        const c = text[i]!;
        if (quoted) {
          if (c === '\\' && i + 1 < text.length) {
            inner += text[i + 1];
            i += 2;
            continue;
          }
          if (c === quoted) {
            quoted = null;
            i += 1;
            continue;
          }
          inner += c;
          i += 1;
          continue;
        }
        if (c === '"' || c === "'") {
          quoted = c;
          sawQuote = true;
          i += 1;
          continue;
        }
        if (c === ']') break;
        inner += c;
        i += 1;
      }
      if (text[i] !== ']') return null;
      i += 1;
      // Filters, slices, unions and script expressions are not concrete paths.
      if (inner === '' || inner === '*' || inner.includes(',')) return null;
      if (!sawQuote && /^[?(:*]/.test(inner)) return null;
      if (!sawQuote && /^\d+$/.test(inner)) {
        tokens.push(Number(inner));
        continue;
      }
      tokens.push(inner);
      continue;
    }
    // Anything else (filters, scripts, unions) is not a concrete single path.
    return null;
  }

  return tokens;
}

/** True when two path expressions point at the same node. */
export function samePath(a: string, b: string): boolean {
  const left = parsePathTokens(a);
  const right = parsePathTokens(b);
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((token, index) => String(token) === String(right[index]));
}

/**
 * Convert any concrete path expression into the tree view's notation
 * (`$.store.book[0].title`). Returns `null` for non-concrete paths.
 */
export function toTreePath(input: string): string | null {
  const tokens = parsePathTokens(input);
  if (!tokens) return null;
  let out = '$';
  for (const token of tokens) {
    if (typeof token === 'number') out += `[${token}]`;
    else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token)) out += `.${token}`;
    else out += `[${JSON.stringify(token)}]`;
  }
  return out;
}
