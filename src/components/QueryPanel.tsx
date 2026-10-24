import { useEffect, useState } from 'react';
import type { QueryResult } from '../lib/query';
import { QUERY_EXAMPLES } from '../lib/query';

export interface QueryPanelProps {
  result: QueryResult | null;
  running: boolean;
  onRun: (expression: string) => void;
  onCopy: (text: string) => void;
  /** Jump to the matching node in the tree panel. */
  onLocate: (path: string) => void;
}

/** What the query engine actually supports — shown so the scope is never a guess. */
const SUPPORT: Array<{ syntax: string; meaning: string }> = [
  { syntax: '$', meaning: '根节点' },
  { syntax: '.key  /  [\'key\']', meaning: '按名字取成员' },
  { syntax: '[0]  /  [0,2]  /  [1:3]', meaning: '数组下标、索引列表、切片' },
  { syntax: '[*]', meaning: '子元素通配符（对象取全部值）' },
  { syntax: '..key  /  ..*', meaning: '递归下降（任意深度）' },
  { syntax: '[?(@.price > 10)]', meaning: '过滤表达式（比较、逻辑、正则 =~）' },
  { syntax: '[\'a\',\'b\']', meaning: '联合：一次取多个名字' },
  { syntax: '@  /  $  /  ^', meaning: '当前节点 / 根节点 / 父节点' },
];

export function QueryPanel({ result, running, onRun, onCopy, onLocate }: QueryPanelProps) {
  const [expression, setExpression] = useState('$.store.book[*].title');
  const [showSupport, setShowSupport] = useState(false);

  // Keep the input showing whatever was executed last (e.g. from an example chip).
  useEffect(() => {
    if (result?.query) setExpression(result.query);
  }, [result?.query]);

  const submit = () => {
    if (!expression.trim()) return;
    onRun(expression);
  };

  return (
    <div className="query" data-testid="query-panel">
      <div>
        <h4 className="section-title">JSONPath 查询</h4>
        <div className="query-row" style={{ marginTop: 8 }}>
          <input
            className="input mono"
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            placeholder="$.store.book[*].title"
            aria-label="JSONPath 表达式"
            data-testid="query-input"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button type="button" className="btn btn-primary" onClick={submit} disabled={running} data-testid="query-run">
            {running ? '查询中…' : '查询'}
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--text-faint)' }}>
          引擎：JSONPath Plus（jsonpath-plus, MIT）。支持范围见{' '}
          <button
            type="button"
            className="mini-btn"
            onClick={() => setShowSupport((value) => !value)}
            style={{ verticalAlign: 'baseline' }}
            data-testid="query-support-toggle"
          >
            {showSupport ? '收起语法表' : '语法表'}
          </button>
          。过滤表达式只做取值比较，不会执行任意代码。
        </p>
        {showSupport ? (
          <div className="support-table" data-testid="query-support-table">
            {SUPPORT.map((row) => (
              <div className="support-row" key={row.syntax}>
                <code className="mono">{row.syntax}</code>
                <span>{row.meaning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <h4 className="section-title">示例表达式</h4>
        <div className="chips" style={{ marginTop: 8 }}>
          {QUERY_EXAMPLES.map((example) => (
            <button
              key={example.expression}
              type="button"
              className="chip"
              title={example.hint}
              data-testid="query-example"
              onClick={() => {
                setExpression(example.expression);
                onRun(example.expression);
              }}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="section-title">结果</h4>
        <div style={{ marginTop: 8 }}>
          {result === null ? (
            <div className="empty" style={{ minHeight: 140, height: 'auto' }}>
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </div>
              <h3>尚未执行查询</h3>
              <p>输入表达式后点击「查询」，命中节点会连同它的 JSONPath 一起显示。</p>
            </div>
          ) : !result.ok ? (
            <div className="result-card" style={{ borderColor: 'var(--danger)' }}>
              <div className="result-head" style={{ color: 'var(--danger)' }}>
                查询失败
              </div>
              <pre className="result-body" style={{ color: 'var(--danger)' }} data-testid="query-error">
                {result.error}
              </pre>
            </div>
          ) : result.count === 0 ? (
            <div className="empty" style={{ minHeight: 140, height: 'auto' }} data-testid="query-empty">
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </div>
              <h3>没有匹配结果</h3>
              <p>
                表达式 <code className="mono">{result.query}</code> 命中 0 个节点。
              </p>
            </div>
          ) : (
            <div data-testid="query-results">
              <div className="result-head">
                <span>命中 {result.count} 条</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span style={{ color: 'var(--text-faint)' }}>{result.elapsedMs} ms</span>
                <button
                  type="button"
                  className="mini-btn"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => onCopy(result.hits.map((hit) => hit.json).join('\n'))}
                  data-testid="query-copy-all"
                >
                  复制全部
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {result.hits.map((hit, index) => (
                  <div className="result-card" key={`${hit.path}-${index}`} data-testid="query-hit">
                    <div className="result-head">
                      <span title={hit.path}>{hit.path}</span>
                      <button
                        type="button"
                        className="mini-btn"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => onLocate(hit.path)}
                        data-testid="query-locate"
                      >
                        定位
                      </button>
                      <button type="button" className="mini-btn" onClick={() => onCopy(hit.json)}>
                        复制
                      </button>
                    </div>
                    <pre className="result-body">{hit.json}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
