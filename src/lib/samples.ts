/**
 * Ready-to-use sample documents shipped with the app.
 *
 * Design goals:
 *  - breadth, not just volume: every sample exercises a different *shape* of
 *    JSON (flat config, deep nesting, arrays of arrays, geo coordinates,
 *    RPC envelopes, i18n plurals, log streams, schema documents, …);
 *  - deterministic: no `Math.random()` anywhere, so screenshots and tests stay
 *    reproducible;
 *  - honest: every entry with `valid !== false` is parsed by the unit tests, so
 *    a typo can never ship as "example data that errors".
 */

export type SampleCategory = '入门' | 'API' | '配置' | '数据' | '边界';

export interface SampleData {
  id: string;
  name: string;
  description: string;
  category: SampleCategory;
  /** Human hint about what this sample is good for demonstrating. */
  hint?: string;
  /** `false` for the intentionally broken samples. */
  valid?: boolean;
  text: string;
}

/* ------------------------------------------------------------------ 入门 */

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

export const SAMPLE_EDGE_CASES = `{
  "unicode": "😀 中文字符 éàü ñ 🩺🧪",
  "surrogatePairs": "𝕏 𝔘𝔫𝔦𝔠𝔬𝔡𝔢 👨‍👩‍👧‍👦 🇨🇳",
  "escapes": {
    "quote": "say \\"hi\\"",
    "backslash": "a\\\\b",
    "newline": "a\\nb",
    "tab": "a\\tb",
    "carriageReturn": "a\\rb",
    "formFeed": "a\\fb",
    "backspace": "a\\bb",
    "solidus": "a\\/b",
    "unicodeEscape": "\\u4e2d\\u6587"
  },
  "numbers": {
    "zero": 0,
    "negativeZero": -0,
    "float": 3.14159,
    "exponent": 1.5e10,
    "negativeExponent": 2e-8,
    "maxSafe": 9007199254740991,
    "minSafe": -9007199254740991,
    "tiny": 5e-324
  },
  "emptyContainers": { "object": {}, "array": [] },
  "types": { "string": "text", "number": 42, "booleanTrue": true, "booleanFalse": false, "nullValue": null },
  "deeplyNested": { "l1": { "l2": { "l3": { "l4": { "l5": { "l6": { "leaf": "价值" } } } } } } },
  "mixedArray": [1, "two", true, null, [], {}, [1, [2, [3, [4]]]]],
  "emptyString": ""
}`;

/* ------------------------------------------------------------------- API */

export const SAMPLE_API = `{
  "meta": {
    "requestId": "7f2c1b4e-0d3a-4f8b-9c21-2ad4e6f8b0c1",
    "durationMs": 42,
    "status": "ok",
    "rateLimit": { "limit": 5000, "remaining": 4875, "resetAt": "2026-10-25T01:00:00Z" }
  },
  "data": {
    "users": [
      { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "roles": ["admin", "dev"], "active": true, "lastLogin": null, "profile": { "locale": "en-GB", "timezone": "Europe/London", "avatarUrl": null } },
      { "id": 2, "name": "Grace Hopper", "email": "grace@example.com", "roles": ["dev"], "active": true, "lastLogin": "2026-10-24T09:12:00Z", "profile": { "locale": "en-US", "timezone": "America/New_York", "avatarUrl": "https://example.com/grace.png" } },
      { "id": 3, "name": "Alan Turing", "email": "alan@example.com", "roles": [], "active": false, "lastLogin": null, "profile": { "locale": "en-GB", "timezone": "Europe/London", "avatarUrl": null } },
      { "id": 4, "name": "张伟", "email": "zhangwei@example.cn", "roles": ["ops"], "active": true, "lastLogin": "2026-10-25T00:30:00+08:00", "profile": { "locale": "zh-CN", "timezone": "Asia/Shanghai", "avatarUrl": null } }
    ],
    "pagination": { "page": 1, "pageSize": 25, "total": 4, "hasNext": false },
    "errors": [],
    "links": { "self": "/v1/users?page=1", "next": null }
  }
}`;

export const SAMPLE_RPC = `{
  "jsonrpc": "2.0",
  "id": 91,
  "result": {
    "chainId": 1,
    "blockNumber": 21345678,
    "blockHash": "0x9b1f3c2e4d5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
    "timestamp": "2026-10-25T00:12:34Z",
    "transactions": [
      { "hash": "0xaaa1", "from": "0x1111", "to": "0x2222", "value": "1000000000000000", "gasUsed": 21000, "status": "success" },
      { "hash": "0xaaa2", "from": "0x3333", "to": "0x4444", "value": "0", "gasUsed": 51234, "status": "reverted" },
      { "hash": "0xaaa3", "from": "0x5555", "to": null, "value": "0", "gasUsed": 64000, "status": "success" }
    ],
    "logs": [
      { "address": "0x5555", "topics": ["0xddf252ad", "0x00000001"], "data": "0x00", "removed": false },
      { "address": "0x6666", "topics": ["0x8c5be1e5"], "data": "0x01", "removed": true }
    ]
  },
  "error": null
}`;

/* ------------------------------------------------------------------ 配置 */

export const SAMPLE_PACKAGE_JSON = `{
  "name": "acme-workbench",
  "version": "3.2.1",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --max-warnings 0",
    "check": "npm run lint && npm run test && npm run build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^3.2.7"
  },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "pnpm": { "overrides": { "esbuild": "^0.25.0" } }
}`;

export const SAMPLE_I18N = `{
  "locale": "zh-CN",
  "fallback": "en",
  "messages": {
    "app": {
      "title": "JSON 手术室",
      "tagline": "本地运行的 JSON 工作台",
      "actions": { "format": "格式化", "minify": "压缩", "copy": "复制", "clear": "清空" }
    },
    "errors": {
      "parse": "无法解析 JSON：{detail}",
      "tooLarge": "文档过大（{size}），上限为 {limit}",
      "network": "网络已断开，请重试"
    },
    "plurals": {
      "items_one": "{count} 个项目",
      "items_other": "{count} 个项目",
      "files_one": "{count} 个文件",
      "files_other": "{count} 个文件"
    },
    "dates": { "short": "YYYY-MM-DD", "long": "YYYY年M月D日 dddd", "timezone": "Asia/Shanghai" }
  },
  "meta": {
    "completeness": 0.982,
    "translators": ["Ada", "张伟"],
    "updatedAt": "2026-10-20T11:00:00+08:00"
  }
}`;

export const SAMPLE_JSON_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/user.json",
  "title": "User",
  "description": "A user of the system",
  "type": "object",
  "required": ["id", "email", "createdAt"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "email": { "type": "string", "format": "email", "maxLength": 254 },
    "displayName": { "type": "string", "minLength": 1, "maxLength": 64 },
    "roles": {
      "type": "array",
      "items": { "type": "string", "enum": ["admin", "dev", "ops", "viewer"] },
      "uniqueItems": true,
      "default": ["viewer"]
    },
    "profile": {
      "type": "object",
      "properties": {
        "locale": { "type": "string", "pattern": "^[a-z]{2}(-[A-Z]{2})?$" },
        "timezone": { "type": "string" }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "deletedAt": { "type": ["string", "null"], "format": "date-time" }
  },
  "examples": [
    { "id": 1, "email": "ada@example.com", "roles": ["admin"], "createdAt": "2026-01-01T00:00:00Z" }
  ]
}`;

/* ------------------------------------------------------------------ 数据 */

export const SAMPLE_GEOJSON = `{
  "type": "FeatureCollection",
  "name": "shanghai_landmarks",
  "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "外滩", "nameEn": "The Bund", "kind": "landmark", "visitors": 1200000 },
      "geometry": { "type": "Point", "coordinates": [121.4903, 31.2397] }
    },
    {
      "type": "Feature",
      "properties": { "name": "东方明珠", "nameEn": "Oriental Pearl Tower", "kind": "tower", "heightM": 468 },
      "geometry": { "type": "Point", "coordinates": [121.4998, 31.2397] }
    },
    {
      "type": "Feature",
      "properties": { "name": "世纪公园", "nameEn": "Century Park", "kind": "park", "areaHa": 140.3 },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[121.5401, 31.2154], [121.5567, 31.2154], [121.5567, 31.2261], [121.5401, 31.2261], [121.5401, 31.2154]]]
      }
    }
  ],
  "bbox": [121.4903, 31.2154, 121.5567, 31.2397]
}`;

export const SAMPLE_TIMESERIES = `{
  "metric": "http_requests_total",
  "unit": "requests",
  "interval": "1h",
  "window": { "from": "2026-10-24T00:00:00Z", "to": "2026-10-24T11:00:00Z" },
  "labels": { "service": "json-surgery", "region": "ap-east-1", "status": "2xx" },
  "series": [
    { "t": "2026-10-24T00:00:00Z", "v": 1204, "p95ms": 42 },
    { "t": "2026-10-24T01:00:00Z", "v": 980, "p95ms": 39 },
    { "t": "2026-10-24T02:00:00Z", "v": 745, "p95ms": 35 },
    { "t": "2026-10-24T03:00:00Z", "v": 612, "p95ms": 33 },
    { "t": "2026-10-24T04:00:00Z", "v": 890, "p95ms": 41 },
    { "t": "2026-10-24T05:00:00Z", "v": 1502, "p95ms": 55 },
    { "t": "2026-10-24T06:00:00Z", "v": 2310, "p95ms": 61 },
    { "t": "2026-10-24T07:00:00Z", "v": 3120, "p95ms": 72 },
    { "t": "2026-10-24T08:00:00Z", "v": 3644, "p95ms": 78 },
    { "t": "2026-10-24T09:00:00Z", "v": 3401, "p95ms": 74 },
    { "t": "2026-10-24T10:00:00Z", "v": 2988, "p95ms": 66 },
    { "t": "2026-10-24T11:00:00Z", "v": 2650, "p95ms": 59 }
  ],
  "summary": { "total": 27046, "peak": 3644, "p95ms": 78, "errorRate": 0.0031 }
}`;

export const SAMPLE_LOGS = `[
  { "ts": "2026-10-25T00:00:01.114Z", "level": "info", "service": "api", "msg": "server started", "port": 8080, "pid": 4412 },
  { "ts": "2026-10-25T00:00:02.882Z", "level": "debug", "service": "db", "msg": "connection pool ready", "pool": { "size": 10, "idle": 10 } },
  { "ts": "2026-10-25T00:00:04.003Z", "level": "info", "service": "api", "msg": "GET /v1/users", "status": 200, "durationMs": 12, "requestId": "r-001" },
  { "ts": "2026-10-25T00:00:05.771Z", "level": "warn", "service": "api", "msg": "slow query", "durationMs": 1840, "sql": "select * from users where email like ?" },
  { "ts": "2026-10-25T00:00:07.240Z", "level": "error", "service": "worker", "msg": "job failed", "job": "reindex", "attempt": 3, "error": { "name": "TimeoutError", "message": "operation timed out after 30s", "retryable": true } },
  { "ts": "2026-10-25T00:00:09.515Z", "level": "info", "service": "worker", "msg": "job succeeded", "job": "reindex", "attempt": 4, "durationMs": 6120 },
  { "ts": "2026-10-25T00:00:12.008Z", "level": "fatal", "service": "api", "msg": "out of memory", "heapUsedMb": 1987, "heapTotalMb": 2048 }
]`;

export const SAMPLE_ORDERS = `{
  "orders": [
    {
      "id": "ORD-2026-0001",
      "createdAt": "2026-10-24T09:15:00+08:00",
      "status": "paid",
      "customer": { "id": "C-8842", "name": "张伟", "email": "zhangwei@example.cn", "vip": true },
      "items": [
        { "sku": "SKU-1001", "name": "机械键盘", "qty": 1, "unitPrice": 699.0, "currency": "CNY" },
        { "sku": "SKU-2007", "name": "腕托", "qty": 2, "unitPrice": 89.0, "currency": "CNY" }
      ],
      "shipping": {
        "method": "顺丰",
        "fee": 0,
        "address": { "province": "上海市", "city": "上海", "district": "浦东新区", "postalCode": "200120" }
      },
      "totals": { "subtotal": 877.0, "discount": 50.0, "shipping": 0, "tax": 0, "grandTotal": 827.0 },
      "paidAt": "2026-10-24T09:16:23+08:00",
      "refund": null
    },
    {
      "id": "ORD-2026-0002",
      "createdAt": "2026-10-24T14:02:11+08:00",
      "status": "refunded",
      "customer": { "id": "C-1123", "name": "Ada Lovelace", "email": "ada@example.com", "vip": false },
      "items": [
        { "sku": "SKU-3005", "name": "显示器支架", "qty": 1, "unitPrice": 259.0, "currency": "CNY" }
      ],
      "shipping": {
        "method": "中通",
        "fee": 12.0,
        "address": { "province": "北京市", "city": "北京", "district": "朝阳区", "postalCode": "100020" }
      },
      "totals": { "subtotal": 259.0, "discount": 0, "shipping": 12.0, "tax": 0, "grandTotal": 271.0 },
      "paidAt": "2026-10-24T14:03:02+08:00",
      "refund": { "amount": 271.0, "reason": "尺寸不符", "at": "2026-10-25T08:00:00+08:00" }
    }
  ],
  "summary": { "count": 2, "revenue": 1098.0, "refunded": 271.0, "currency": "CNY" }
}`;

export const SAMPLE_MATRIX = `{
  "name": "quarterly_revenue",
  "format": "rows-with-header",
  "columns": ["region", "q1", "q2", "q3", "q4"],
  "rows": [
    ["APAC", 120400, 131200, 128900, 145600],
    ["EMEA", 98200, 101500, 99600, 112300],
    ["AMER", 201300, 214700, 208100, 231400]
  ],
  "totals": [419900, 447400, 436600, 489300],
  "note": "单位：千元。行矩阵适合演示「数组的数组」——Diff 会按位置比较内层数组。"
}`;

export const SAMPLE_FILE_TREE = `{
  "name": "json-surgery",
  "type": "directory",
  "children": [
    {
      "name": "src",
      "type": "directory",
      "children": [
        {
          "name": "lib",
          "type": "directory",
          "children": [
            { "name": "parser.ts", "type": "file", "size": 16674, "lines": 498 },
            { "name": "format.ts", "type": "file", "size": 5012, "lines": 156 },
            { "name": "diff.ts", "type": "file", "size": 4581, "lines": 148 },
            { "name": "query.ts", "type": "file", "size": 5618, "lines": 172 },
            { "name": "stats.ts", "type": "file", "size": 2059, "lines": 78 }
          ]
        },
        {
          "name": "components",
          "type": "directory",
          "children": [
            { "name": "JsonEditor.tsx", "type": "file", "size": 8954 },
            { "name": "TreeView.tsx", "type": "file", "size": 10351 },
            { "name": "DiffPanel.tsx", "type": "file", "size": 4249 },
            { "name": "MobileSheet.tsx", "type": "file", "size": 3900 }
          ]
        },
        { "name": "App.tsx", "type": "file", "size": 38858 },
        { "name": "styles.css", "type": "file", "size": 30940 }
      ]
    },
    { "name": "package.json", "type": "file", "size": 2325 },
    { "name": "README.md", "type": "file", "size": 13913 },
    { "name": "LICENSE", "type": "file", "size": 1074 }
  ]
}`;

/* ------------------------------------------------------------------ 边界 */

/**
 * Deterministic bulk sample: `count` orders, ~40 KB at the default size.
 *
 * Large enough to exercise the worker path and the paged tree, small enough to
 * stay instant on a phone. Built from arithmetic on the index — no RNG — so the
 * output is byte-identical on every run (screenshots and tests stay stable).
 */
export function buildBulkSample(count = 120): string {
  const statuses = ['paid', 'pending', 'shipped', 'refunded', 'cancelled'];
  const regions = ['APAC', 'EMEA', 'AMER'];
  const products = ['机械键盘', '显示器支架', 'USB-C 集线器', '降噪耳机', '人体工学椅'];
  const orders: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const seed = (i * 2654435761) % 4294967296;
    const qty = (seed % 3) + 1;
    const unitPrice = 59 + ((seed >>> 3) % 900);
    const subtotal = Number((qty * unitPrice).toFixed(2));
    const discount = seed % 5 === 0 ? Number((subtotal * 0.1).toFixed(2)) : 0;
    orders.push(
      JSON.stringify({
        id: `ORD-${String(i + 1).padStart(5, '0')}`,
        status: statuses[seed % statuses.length],
        region: regions[(seed >>> 5) % regions.length],
        customer: { id: `C-${1000 + (seed % 900)}`, vip: seed % 7 === 0 },
        item: {
          sku: `SKU-${2000 + (seed % 500)}`,
          name: products[(seed >>> 7) % products.length],
          qty,
          unitPrice,
        },
        totals: {
          subtotal,
          discount,
          grandTotal: Number((subtotal - discount).toFixed(2)),
          currency: 'CNY',
        },
        tags: seed % 3 === 0 ? ['priority', 'gift'] : ['standard'],
        note: seed % 11 === 0 ? null : `订单备注 ${i + 1}`,
      }),
    );
  }

  return `{
  "generatedBy": "json-surgery sample generator",
  "seed": "deterministic",
  "count": ${count},
  "orders": [
    ${orders.join(',\n    ')}
  ]
}`;
}

export const SAMPLE_INVALID_TRAILING_COMMA = `{
  "name": "broken",
  "list": [1, 2, 3,],
  "trailing": true
}`;

export const SAMPLE_INVALID_MISSING_QUOTE = `{
  "name": broken,
  "note": "未加引号的键值会给出明确的错误位置"
}`;

export const SAMPLE_INVALID_COMMENT = `{
  // JSON 不支持注释：一行注释就会让整篇文档失效
  "port": 8080
}`;

export const SAMPLE_INVALID_TRAILING_CONTENT = `{
  "ok": true
}
{ "second": "document" }`;

/** 300 levels of nesting — exceeds the parser's depth guard on purpose. */
export const SAMPLE_INVALID_DEEP = `${'['.repeat(300)}1${']'.repeat(300)}`;

/* --------------------------------------------------------------- registry */

export const SAMPLES: SampleData[] = [
  {
    id: 'store',
    name: '书店（JSONPath 经典）',
    description: '对象 + 数组 + 嵌套，配 JSONPath 示例最合适',
    category: '入门',
    hint: '试试 $.store.book[*].title 或 $..price',
    text: SAMPLE_STORE,
  },
  {
    id: 'edge',
    name: '边界用例',
    description: '转义、代理对、数字边界、空容器、深层嵌套',
    category: '边界',
    hint: '用来验证「格式化不改变字面量」',
    text: SAMPLE_EDGE_CASES,
  },
  {
    id: 'api',
    name: 'REST API 响应',
    description: '分页、速率限制、多语言用户、null 字段',
    category: 'API',
    hint: '列表类文档，适合看统计面板',
    text: SAMPLE_API,
  },
  {
    id: 'rpc',
    name: 'JSON-RPC 区块数据',
    description: '链上区块 + 交易数组 + 日志事件',
    category: 'API',
    hint: '深一层的数组嵌套，适合 Diff',
    text: SAMPLE_RPC,
  },
  {
    id: 'schema',
    name: 'JSON Schema',
    description: 'draft 2020-12 用户模型，含 enum / pattern',
    category: '配置',
    hint: 'schema 是典型的深嵌套文档',
    text: SAMPLE_JSON_SCHEMA,
  },
  {
    id: 'package',
    name: 'package.json',
    description: '工程配置：脚本、依赖、workspaces',
    category: '配置',
    text: SAMPLE_PACKAGE_JSON,
  },
  {
    id: 'i18n',
    name: '多语言文案',
    description: '中文翻译文件：嵌套键、复数、占位符',
    category: '配置',
    text: SAMPLE_I18N,
  },
  {
    id: 'geojson',
    name: 'GeoJSON 地标',
    description: 'Point / Polygon 坐标，含 bbox',
    category: '数据',
    hint: '浮点数组，适合看数字精度',
    text: SAMPLE_GEOJSON,
  },
  {
    id: 'timeseries',
    name: '时序指标',
    description: '12 个时间点 + 汇总，监控面板常见结构',
    category: '数据',
    text: SAMPLE_TIMESERIES,
  },
  {
    id: 'logs',
    name: '结构化日志',
    description: '7 条日志（含嵌套 error 对象与 fatal 级别）',
    category: '数据',
    hint: '顶层就是数组，适合测数组增删 Diff',
    text: SAMPLE_LOGS,
  },
  {
    id: 'orders',
    name: '电商订单',
    description: '两笔订单：正常 / 已退款，含地址与税额',
    category: '数据',
    text: SAMPLE_ORDERS,
  },
  {
    id: 'matrix',
    name: '行矩阵数据',
    description: '数组的数组（表格导出常见形态）',
    category: '数据',
    hint: '递归查询要点：$..rows[*][0]',
    text: SAMPLE_MATRIX,
  },
  {
    id: 'tree',
    name: '文件树',
    description: '递归 children 结构，最深的树形演示',
    category: '数据',
    hint: '「全部展开」最能体现树形面板效果',
    text: SAMPLE_FILE_TREE,
  },
  {
    id: 'bulk',
    name: '批量订单（120 条）',
    description: '约 40 KB，用来验证大文档不卡',
    category: '边界',
    hint: '状态栏会显示处理耗时',
    text: buildBulkSample(),
  },
  {
    id: 'invalid-comma',
    name: '错误：多余逗号',
    description: '数组末尾多了一个逗号',
    category: '边界',
    valid: false,
    hint: '用来演示错误定位与「跳转」',
    text: SAMPLE_INVALID_TRAILING_COMMA,
  },
  {
    id: 'invalid-quote',
    name: '错误：键未加引号',
    description: '对象键缺少双引号',
    category: '边界',
    valid: false,
    text: SAMPLE_INVALID_MISSING_QUOTE,
  },
  {
    id: 'invalid-comment',
    name: '错误：注释',
    description: 'JSON 不允许注释',
    category: '边界',
    valid: false,
    text: SAMPLE_INVALID_COMMENT,
  },
  {
    id: 'invalid-multi',
    name: '错误：两个文档',
    description: '根值之后还有多余内容',
    category: '边界',
    valid: false,
    text: SAMPLE_INVALID_TRAILING_CONTENT,
  },
  {
    id: 'invalid-deep',
    name: '错误：超深嵌套',
    description: '300 层数组，触发深度上限保护',
    category: '边界',
    valid: false,
    text: SAMPLE_INVALID_DEEP,
  },
];

/** Samples that parse successfully (everything except the deliberate errors). */
export const VALID_SAMPLES = SAMPLES.filter((sample) => sample.valid !== false);

/** Group samples by category, preserving registry order inside each group. */
export function samplesByCategory(): Array<{ category: SampleCategory; items: SampleData[] }> {
  const order: SampleCategory[] = ['入门', 'API', '配置', '数据', '边界'];
  return order
    .map((category) => ({ category, items: SAMPLES.filter((sample) => sample.category === category) }))
    .filter((group) => group.items.length > 0);
}
