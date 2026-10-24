import type { JsonStats } from '../lib/stats';
import { formatBytes, formatCount } from '../lib/format';

export interface StatsPanelProps {
  stats: JsonStats | null;
  length: number;
  bytes: number;
}

interface Row {
  label: string;
  value: number;
  tone: string;
}

export function StatsPanel({ stats, length, bytes }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </div>
        <h3>暂无统计数据</h3>
        <p>输入有效 JSON 后，这里会显示类型分布、键数与嵌套深度。</p>
      </div>
    );
  }

  const rows: Row[] = [
    { label: '对象', value: stats.objects, tone: 'var(--accent)' },
    { label: '数组', value: stats.arrays, tone: 'var(--accent-2)' },
    { label: '字符串', value: stats.strings, tone: 'var(--success)' },
    { label: '数字', value: stats.numbers, tone: 'var(--warning)' },
    { label: '布尔值', value: stats.booleans, tone: 'var(--danger)' },
    { label: 'null', value: stats.nulls, tone: 'var(--text-muted)' },
  ];

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="stats" data-testid="stats-panel">
      <div>
        <h4 className="section-title">总览</h4>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-card accent">
            <div className="stat-value" data-testid="stat-total-nodes">
              {formatCount(stats.totalNodes)}
            </div>
            <div className="stat-label">节点总数</div>
          </div>
          <div className="stat-card accent2">
            <div className="stat-value" data-testid="stat-keys">
              {formatCount(stats.keys)}
            </div>
            <div className="stat-label">键数量</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" data-testid="stat-depth">
              {formatCount(stats.maxDepth)}
            </div>
            <div className="stat-label">最大嵌套深度</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCount(stats.leaves)}</div>
            <div className="stat-label">叶子值</div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="section-title">类型分布</h4>
        <div className="bar-list" style={{ marginTop: 8 }} data-testid="stat-types">
          {rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${(row.value / max) * 100}%`, background: row.tone }}
                />
              </span>
              <span className="bar-value">{formatCount(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="section-title">文档</h4>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-card">
            <div className="stat-value">{formatCount(length)}</div>
            <div className="stat-label">字符数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatBytes(bytes)}</div>
            <div className="stat-label">UTF-8 大小</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCount(stats.objects + stats.arrays)}</div>
            <div className="stat-label">容器数量</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {formatCount(stats.totalNodes - stats.objects - stats.arrays)}
            </div>
            <div className="stat-label">标量数量</div>
          </div>
        </div>
      </div>
    </div>
  );
}
