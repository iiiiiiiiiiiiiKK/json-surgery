/**
 * A strict, dependency-free JSON parser that produces an AST with precise
 * error positions.
 *
 * Why not `JSON.parse`?
 *  - its errors are famously vague ("Unexpected token } in JSON at position 42");
 *  - it silently re-orders integer-like keys, so a formatter built on it can
 *    change the document's byte layout;
 *  - it collapses `1.50`, `1e3` and `-0` into one number, losing the original
 *    literal the user wrote.
 *
 * This parser is strict (RFC 8259), reports line/column and explains *why* a
 * document is invalid. It also collects non-fatal warnings (integers beyond
 * 2^53) so the UI can flag "valid, but suspicious".
 */

import type { JsonEntry, JsonValue } from './ast';

export interface ParseError {
  message: string;
  /** Reason code, useful for tests and for UI badges. */
  code: ParseErrorCode;
  line: number; // 1-based
  column: number; // 1-based
  offset: number; // 0-based character offset
}

export type ParseErrorCode =
  | 'EMPTY_INPUT'
  | 'INVALID_JSON'
  | 'UNEXPECTED_TOKEN'
  | 'UNEXPECTED_END'
  | 'UNEXPECTED_CHARACTER'
  | 'INVALID_STRING'
  | 'INVALID_ESCAPE'
  | 'INVALID_NUMBER'
  | 'DUPLICATE_KEY'
  | 'TRAILING_COMMA'
  | 'TRAILING_CONTENT'
  | 'DEPTH_EXCEEDED'
  | 'SIZE_EXCEEDED';

/**
 * A non-fatal remark about an otherwise valid document. Warnings never block
 * formatting or querying; they are shown next to the value they concern.
 */
export interface ParseWarning {
  code: 'DUPLICATE_KEY' | 'UNSAFE_NUMBER';
  message: string;
  line: number;
  column: number;
}

export interface ParseSuccess {
  ok: true;
  value: JsonValue;
  warnings: ParseWarning[];
}

export interface ParseFailure {
  ok: false;
  error: ParseError;
}

export type ParseResult = ParseSuccess | ParseFailure;

export interface ParseOptions {
  /** Maximum nesting depth accepted. Default 256. */
  maxDepth?: number;
  /** Maximum input length accepted, in characters. Default 16 MiB. */
  maxLength?: number;
  /** Maximum number of warnings collected. Default 20. */
  maxWarnings?: number;
}

export const DEFAULT_MAX_DEPTH = 256;
/** 16 MiB of characters: large enough for real API dumps, small enough to stay responsive. */
export const DEFAULT_MAX_LENGTH = 16 * 1024 * 1024;
export const DEFAULT_MAX_WARNINGS = 20;

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

class Parser {
  private readonly text: string;
  private readonly maxDepth: number;
  private readonly maxWarnings: number;
  private readonly warnings: ParseWarning[] = [];
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(text: string, maxDepth: number, maxWarnings: number) {
    this.text = text;
    this.maxDepth = maxDepth;
    this.maxWarnings = maxWarnings;
  }

  private get eof(): boolean {
    return this.pos >= this.text.length;
  }

  private peek(offset = 0): string {
    return this.text[this.pos + offset] ?? '';
  }

  private advance(count = 1): void {
    for (let i = 0; i < count && this.pos < this.text.length; i += 1) {
      const ch = this.text[this.pos]!;
      this.pos += 1;
      if (ch === '\n') {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
    }
  }

  private warn(code: ParseWarning['code'], message: string, line: number, column: number): void {
    if (this.warnings.length >= this.maxWarnings) return;
    this.warnings.push({ code, message, line, column });
  }

  private fail(code: ParseErrorCode, message: string, at = this.pos): ParseFailure {
    const { line, column } = this.positionAt(at);
    return { ok: false, error: { message, code, line, column, offset: at } };
  }

  private positionAt(offset: number): { line: number; column: number } {
    let line = 1;
    let column = 1;
    const limit = Math.min(offset, this.text.length);
    for (let i = 0; i < limit; i += 1) {
      if (this.text[i] === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return { line, column };
  }

  private skipWhitespace(): void {
    while (!this.eof && WHITESPACE.has(this.peek())) this.advance();
  }

  parseDocument(): ParseResult {
    this.skipWhitespace();
    if (this.eof) {
      return this.fail('EMPTY_INPUT', '输入为空：没有可解析的 JSON 内容。', this.pos);
    }
    const result = this.parseValue(0);
    if (!result.ok) return result;
    this.skipWhitespace();
    if (!this.eof) {
      return this.fail(
        'TRAILING_CONTENT',
        `JSON 根值之后存在多余内容（第 ${this.line} 行第 ${this.column} 列）：多余内容应从 “${this.peek()}” 开始。`,
        this.pos,
      );
    }
    return { ok: true, value: result.value, warnings: this.warnings };
  }

  private parseValue(depth: number): { ok: true; value: JsonValue } | ParseFailure {
    if (depth > this.maxDepth) {
      return this.fail(
        'DEPTH_EXCEEDED',
        `嵌套层级超过上限（最大 ${this.maxDepth} 层）。为避免浏览器内存耗尽，已停止解析。`,
        this.pos,
      );
    }
    this.skipWhitespace();
    if (this.eof) {
      return this.fail('UNEXPECTED_END', 'JSON 意外结束：缺少值。', this.pos);
    }
    const ch = this.peek();
    switch (ch) {
      case '{':
        return this.parseObject(depth);
      case '[':
        return this.parseArray(depth);
      case '"':
        return this.parseString();
      case 't':
        return this.parseLiteral('true', { type: 'boolean', value: true });
      case 'f':
        return this.parseLiteral('false', { type: 'boolean', value: false });
      case 'n':
        return this.parseLiteral('null', { type: 'null' });
      default:
        if (ch === '-' || (ch >= '0' && ch <= '9')) return this.parseNumber();
        return this.fail(
          'UNEXPECTED_CHARACTER',
          `意外的字符 “${ch}”：JSON 值必须以 {、[、字符串、数字、true、false 或 null 开头。`,
          this.pos,
        );
    }
  }

  private parseLiteral<T extends JsonValue>(
    literal: string,
    value: T,
  ): { ok: true; value: JsonValue } | ParseFailure {
    if (this.text.startsWith(literal, this.pos)) {
      this.advance(literal.length);
      return { ok: true, value };
    }
    const actual = this.text.slice(this.pos, this.pos + literal.length);
    return this.fail('INVALID_JSON', `无效的字面量 “${actual}”：这里应该是 “${literal}”。`, this.pos);
  }

  private parseObject(depth: number): { ok: true; value: JsonValue } | ParseFailure {
    this.advance(); // consume {
    const entries: JsonEntry[] = [];
    const seen = new Set<string>();
    this.skipWhitespace();
    if (this.eof) {
      return this.fail('UNEXPECTED_END', 'JSON 意外结束：对象缺少右花括号 “}”。', this.pos);
    }
    if (this.peek() === '}') {
      this.advance();
      return { ok: true, value: { type: 'object', entries } };
    }
    for (;;) {
      this.skipWhitespace();
      if (this.eof) {
        return this.fail('UNEXPECTED_END', 'JSON 意外结束：对象缺少右花括号 “}”。', this.pos);
      }
      if (this.peek() !== '"') {
        return this.fail(
          'UNEXPECTED_CHARACTER',
          `对象的键必须是双引号包裹的字符串，但这里出现了 “${this.peek()}”（第 ${this.line} 行第 ${this.column} 列）。`,
          this.pos,
        );
      }
      const keyLine = this.line;
      const keyColumn = this.column;
      const keyResult = this.parseString();
      if (!keyResult.ok) return keyResult;
      const key = (keyResult.value as { type: 'string'; value: string }).value;
      if (seen.has(key)) {
        return this.fail(
          'DUPLICATE_KEY',
          `对象中重复出现键 “${key}”（第 ${keyLine} 行第 ${keyColumn} 列）：RFC 8259 未定义重复键的行为，不同解析器结果不同，因此拒绝解析。`,
          this.pos,
        );
      }
      seen.add(key);
      this.skipWhitespace();
      if (this.eof) {
        return this.fail('UNEXPECTED_END', 'JSON 意外结束：缺少键值分隔符 “:”。', this.pos);
      }
      if (this.peek() !== ':') {
        return this.fail(
          'UNEXPECTED_CHARACTER',
          `键 “${key}” 之后缺少冒号 “:”（第 ${this.line} 行第 ${this.column} 列）。`,
          this.pos,
        );
      }
      this.advance();
      const valueResult = this.parseValue(depth + 1);
      if (!valueResult.ok) return valueResult;
      entries.push({ key, value: valueResult.value });
      this.skipWhitespace();
      if (this.eof) {
        return this.fail('UNEXPECTED_END', 'JSON 意外结束：对象缺少右花括号 “}”。', this.pos);
      }
      const ch = this.peek();
      if (ch === ',') {
        this.advance();
        this.skipWhitespace();
        if (!this.eof && this.peek() === '}') {
          return this.fail(
            'TRAILING_COMMA',
            '对象中存在多余的逗号：最后一个成员之后不允许再出现 “,”（删除末尾逗号即可）。',
            this.pos,
          );
        }
        continue;
      }
      if (ch === '}') {
        this.advance();
        return { ok: true, value: { type: 'object', entries } };
      }
      return this.fail(
        'UNEXPECTED_CHARACTER',
        `对象中缺少 “,” 或 “}”（第 ${this.line} 行第 ${this.column} 列，遇到字符 “${ch}”）。`,
        this.pos,
      );
    }
  }

  private parseArray(depth: number): { ok: true; value: JsonValue } | ParseFailure {
    this.advance(); // consume [
    const items: JsonValue[] = [];
    this.skipWhitespace();
    if (this.eof) {
      return this.fail('UNEXPECTED_END', 'JSON 意外结束：数组缺少右方括号 “]”。', this.pos);
    }
    if (this.peek() === ']') {
      this.advance();
      return { ok: true, value: { type: 'array', items } };
    }
    for (;;) {
      const valueResult = this.parseValue(depth + 1);
      if (!valueResult.ok) return valueResult;
      items.push(valueResult.value);
      this.skipWhitespace();
      if (this.eof) {
        return this.fail('UNEXPECTED_END', 'JSON 意外结束：数组缺少右方括号 “]”。', this.pos);
      }
      const ch = this.peek();
      if (ch === ',') {
        this.advance();
        this.skipWhitespace();
        if (!this.eof && this.peek() === ']') {
          return this.fail(
            'TRAILING_COMMA',
            '数组中存在多余的逗号：最后一个元素之后不允许再出现 “,”（删除末尾逗号即可）。',
            this.pos,
          );
        }
        continue;
      }
      if (ch === ']') {
        this.advance();
        return { ok: true, value: { type: 'array', items } };
      }
      return this.fail(
        'UNEXPECTED_CHARACTER',
        `数组中缺少 “,” 或 “]”（第 ${this.line} 行第 ${this.column} 列，遇到字符 “${ch}”）。`,
        this.pos,
      );
    }
  }

  private parseString(): { ok: true; value: JsonValue } | ParseFailure {
    const start = this.pos;
    this.advance(); // consume opening quote
    let out = '';
    for (;;) {
      if (this.eof) {
        return this.fail('INVALID_STRING', '字符串没有结束：缺少右双引号 “"”。', start);
      }
      const ch = this.peek();
      if (ch === '"') {
        this.advance();
        return { ok: true, value: { type: 'string', value: out } };
      }
      if (ch === '\\') {
        const escapePos = this.pos;
        this.advance();
        if (this.eof) {
          return this.fail('INVALID_STRING', '转义字符不完整：反斜杠后没有内容。', escapePos);
        }
        const esc = this.peek();
        switch (esc) {
          case '"':
            out += '"';
            break;
          case '\\':
            out += '\\';
            break;
          case '/':
            out += '/';
            break;
          case 'b':
            out += '\b';
            break;
          case 'f':
            out += '\f';
            break;
          case 'n':
            out += '\n';
            break;
          case 'r':
            out += '\r';
            break;
          case 't':
            out += '\t';
            break;
          case 'u': {
            const hex = this.text.slice(this.pos + 1, this.pos + 5);
            if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
              return this.fail(
                'INVALID_ESCAPE',
                `无效的 Unicode 转义 “\\u${hex}”：\\u 后面必须紧跟 4 位十六进制数字。`,
                escapePos,
              );
            }
            out += String.fromCharCode(parseInt(hex, 16));
            this.advance(4); // consume the 4 hex digits
            break;
          }
          default:
            return this.fail(
              'INVALID_ESCAPE',
              `无效的转义字符 “\\${esc}”：JSON 只支持 \\"、\\\\、\\/、\\b、\\f、\\n、\\r、\\t 和 \\uXXXX。`,
              escapePos,
            );
        }
        this.advance();
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        return this.fail(
          'INVALID_STRING',
          `字符串中出现未转义的控制字符 (0x${code.toString(16).padStart(2, '0')})：必须写成 \\n、\\t 等转义形式。`,
          this.pos,
        );
      }
      out += ch;
      this.advance();
    }
  }

  private parseNumber(): { ok: true; value: JsonValue } | ParseFailure {
    const start = this.pos;
    const startLine = this.line;
    const startColumn = this.column;
    if (this.peek() === '-') this.advance();
    if (this.eof) {
      return this.fail('INVALID_NUMBER', '数字不完整：负号后缺少数字。', start);
    }
    if (this.peek() === '0') {
      this.advance();
      // Leading zeros ("01") are invalid; flag the exact character.
      if (!this.eof && this.peek() >= '0' && this.peek() <= '9') {
        return this.fail(
          'INVALID_NUMBER',
          `无效的数字 “${this.text.slice(start, this.pos + 1)}”：JSON 不允许以 0 开头的多位整数。`,
          this.pos,
        );
      }
    } else if (this.peek() >= '1' && this.peek() <= '9') {
      while (!this.eof && this.peek() >= '0' && this.peek() <= '9') this.advance();
    } else {
      return this.fail('INVALID_NUMBER', `无效的数字 “${this.peek()}”：数字必须以 0-9 开头。`, this.pos);
    }
    if (!this.eof && this.peek() === '.') {
      this.advance();
      if (this.eof || this.peek() < '0' || this.peek() > '9') {
        return this.fail('INVALID_NUMBER', '无效的数字：小数点后至少要有一位数字。', start);
      }
      while (!this.eof && this.peek() >= '0' && this.peek() <= '9') this.advance();
    }
    if (!this.eof && (this.peek() === 'e' || this.peek() === 'E')) {
      this.advance();
      if (!this.eof && (this.peek() === '+' || this.peek() === '-')) this.advance();
      if (this.eof || this.peek() < '0' || this.peek() > '9') {
        return this.fail('INVALID_NUMBER', '无效的数字：指数部分至少要有一位数字。', start);
      }
      while (!this.eof && this.peek() >= '0' && this.peek() <= '9') this.advance();
    }
    const raw = this.text.slice(start, this.pos);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return this.fail('INVALID_NUMBER', `数字 “${raw}” 超出了可表示的有限范围。`, start);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      this.warn(
        'UNSAFE_NUMBER',
        `整数 ${raw} 超出 ±2^53-1，解析后精度可能已经丢失。`,
        startLine,
        startColumn,
      );
    }
    return { ok: true, value: { type: 'number', value, raw } };
  }
}

/**
 * Parse a JSON document.
 *
 * @returns a discriminated union so callers must handle the failure path.
 */
export function parseJson(input: string, options: ParseOptions = {}): ParseResult {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxWarnings = options.maxWarnings ?? DEFAULT_MAX_WARNINGS;
  if (input.length > maxLength) {
    return {
      ok: false,
      error: {
        message: `输入过大（${input.length.toLocaleString('zh-CN')} 字符），超过 ${maxLength.toLocaleString('zh-CN')} 字符上限。请拆分文件，或使用压缩后的 JSON。`,
        code: 'SIZE_EXCEEDED',
        line: 1,
        column: 1,
        offset: 0,
      },
    };
  }
  const parser = new Parser(input, maxDepth, maxWarnings);
  return parser.parseDocument();
}
