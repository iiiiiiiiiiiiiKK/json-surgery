/** Ready-to-use sample documents shipped with the app. */

export interface SampleData {
  id: string;
  name: string;
  description: string;
  text: string;
}

export const SAMPLE_STORE = `{
  "store": {
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },
      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99 }
    ],
    "bicycle": {
      "color": "red",
      "price": 19.95,
      "size": { "width": 28, "height": 30, "unit": "in" },
      "tags": ["frame", "wheel", "brake"],
      "inStock": true,
      "owner": null
    }
  },
  "meta": {
    "generatedAt": "2026-10-25T00:00:00.000Z",
    "schemaVersion": 3,
    "unicode": "手术室 · 手术台 · 🩺",
    "escaped": "line1\\nline2\\t\\"quoted\\"",
    "limits": { "max": 9007199254740991, "min": -9007199254740991, "epsilon": 1e-9 }
  }
}`;

export const SAMPLE_API = `{
  "meta": {
    "requestId": "7f2c1b4e-0d3a-4f8b-9c21-2ad4e6f8b0c1",
    "durationMs": 42,
    "status": "ok"
  },
  "data": {
    "users": [
      { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "roles": ["admin", "dev"], "active": true, "lastLogin": null },
      { "id": 2, "name": "Grace Hopper", "email": "grace@example.com", "roles": ["dev"], "active": true, "lastLogin": "2026-10-24T09:12:00Z" },
      { "id": 3, "name": "Alan Turing", "email": "alan@example.com", "roles": [], "active": false, "lastLogin": null }
    ],
    "pagination": { "page": 1, "pageSize": 25, "total": 3, "hasNext": false },
    "errors": []
  }
}`;

export const SAMPLE_EDGE_CASES = `{
  "unicode": "😀 中文字符 éàü ñ",
  "escapes": { "quote": "say \\"hi\\"", "backslash": "a\\\\b", "newline": "a\\nb", "tab": "a\\tb", "solidus": "a\\/b" },
  "numbers": { "zero": 0, "negative": -0, "float": 3.14159, "exponent": 1.5e10, "negativeExponent": 2e-8, "big": 9007199254740991 },
  "emptyContainers": { "object": {}, "array": [] },
  "types": { "string": "text", "number": 42, "booleanTrue": true, "booleanFalse": false, "nullValue": null },
  "nested": { "level1": { "level2": { "level3": { "level4": { "deep": "value" } } } } }
}`;

export const SAMPLE_INVALID = `{
  "name": "broken",
  "list": [1, 2, 3,],
  "trailing": true
}`;

export const SAMPLES: SampleData[] = [
  {
    id: 'store',
    name: '经典商店数据',
    description: '嵌套对象、数组、Unicode 与数字边界',
    text: SAMPLE_STORE,
  },
  {
    id: 'api',
    name: 'API 响应',
    description: '分页、用户列表、空数组与 null 字段',
    text: SAMPLE_API,
  },
  {
    id: 'edge',
    name: '边界用例',
    description: '转义字符、空容器、深层嵌套',
    text: SAMPLE_EDGE_CASES,
  },
  {
    id: 'invalid',
    name: '错误示例',
    description: '故意包含多余逗号，用于演示错误定位',
    text: SAMPLE_INVALID,
  },
];
