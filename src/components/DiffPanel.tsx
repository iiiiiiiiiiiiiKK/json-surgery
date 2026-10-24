import type { DiffResult } from '../lib/diff';

export interface DiffPanelProps {
  result: DiffResult | null;
  error: string | null;
  leftError: { message: string; line: number; column: number } | null;
  rightError: { message: string; line: number; column: number } | null;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'added':
      return '新增';
    case 'removed':
      return '删除';
    case 'changed':
      return '修改';
    case 'type-changed':
      return '类型变化';
    default:
      return kind;
  }
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    const text = JSON.stringify(value);
    return text && text.length > 160 ? `${text.slice(0, 159)}…` : (text ?? String(value));
  } catch {
    return String(value);
  }
}

export function DiffPanel({ result, error, leftError, rightError }: DiffPanelProps) {
  if (error) {
    return (
      <div className="empty">
        <div className="empty-icon" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 4l9 16H3z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
        </div>
        <h3 style={{ color: 'var(--danger)' }}>无法比较</h3>
        <p>{error}</p>
        {leftError ? (
          <p>
            左侧位置：第 {leftError.line} 行第 {leftError.column} 列
          </p>
        ) : null}
        {rightError ? (
          <p>
            右侧位置：第 {rightError.line} 行第 {rightError.column} 列
          </p>
        ) : null}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4" />
          </svg>
        </div>
        <h3>等待比较</h3>
        <p>在左右两侧输入 JSON，系统会自动比较并标出新增、删除与修改。</p>
      </div>
    );
  }

  if (result.summary.identical) {
    return (
      <div className="empty" data-testid="diff-identical">
        <div className="empty-icon" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </div>
        <h3>两个文档完全一致</h3>
        <p>没有检测到任何差异。</p>
      </div>
    );
  }

  return (
    <div className="diff" data-testid="diff-panel">
      <div className="diff-head">
        <div className="diff-summary">
          <span className="pill added">新增 {result.summary.added}</span>
          <span className="pill removed">删除 {result.summary.removed}</span>
          <span className="pill changed">修改 {result.summary.changed}</span>
          {result.summary.typeChanged > 0 ? (
            <span className="pill">类型变化 {result.summary.typeChanged}</span>
          ) : null}
          <span className="pill">共 {result.summary.total} 处差异</span>
        </div>
      </div>
      <div>
        {result.entries.map((entry, index) => (
          <div className={`diff-row ${entry.kind}`} key={`${entry.path}-${index}`} data-testid="diff-row">
            <div className="diff-path" title={entry.path}>
              {entry.path}
            </div>
            <div className="diff-detail">
              <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{kindLabel(entry.kind)} · {entry.summary}</div>
              {entry.before !== null ? (
                <div className="diff-values diff-before">− {summarizeValue(entry.before)}</div>
              ) : null}
              {entry.after !== null ? (
                <div className="diff-values diff-after">+ {summarizeValue(entry.after)}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
