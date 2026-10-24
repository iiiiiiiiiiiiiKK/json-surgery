import { useEffect, useMemo, useRef, useState } from 'react';
import type { SerializedTreeNode } from '../lib/protocol';

export interface TreeViewProps {
  nodes: SerializedTreeNode[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  search: string;
  matchedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCopyPath: (node: SerializedTreeNode) => void;
  onCopyValue: (node: SerializedTreeNode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  truncated?: boolean;
}

/**
 * Rows that are actually rendered.
 *
 * Visibility is derived from the expansion set: a row is visible only when all
 * of its ancestors are open. Collapsing a node therefore hides its whole
 * subtree, which is what makes browsing a 20k node document usable.
 */
function computeVisible(
  nodes: SerializedTreeNode[],
  expanded: Set<string>,
  searching: boolean,
  matchedIds: Set<string>,
): SerializedTreeNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));

  // In search mode we keep the hierarchy readable: a row is shown when it is a
  // match, an ancestor of a match (so the path is visible) or a descendant of a
  // match (so the matched subtree stays explorable). Everything else is hidden.
  let keep: Set<string> | null = null;
  if (searching) {
    keep = new Set<string>();
    for (const node of nodes) {
      if (!matchedIds.has(node.id)) continue;
      keep.add(node.id);
      let parentId = node.parentId;
      while (parentId) {
        keep.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
    const includeDescendants = (nodeId: string) => {
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const child of nodes) {
          if (child.parentId !== current) continue;
          if (!keep!.has(child.id)) keep!.add(child.id);
          stack.push(child.id);
        }
      }
    };
    for (const id of Array.from(keep)) includeDescendants(id);
  }

  const visible: SerializedTreeNode[] = [];
  const openContainers = new Set<string>();

  for (const node of nodes) {
    const parentVisible = node.parentId === null || openContainers.has(node.parentId);
    if (!parentVisible) continue;
    if (keep && !keep.has(node.id)) continue;

    visible.push(node);

    const isOpen = searching ? node.hasChildren : expanded.has(node.id);
    if (isOpen) openContainers.add(node.id);
  }
  return visible;
}

function containerClass(node: SerializedTreeNode): string {
  return node.type === 'object' || node.type === 'array' ? 'tree-preview' : 'tree-null';
}

function renderScalar(node: SerializedTreeNode) {
  switch (node.type) {
    case 'string':
      return <span className="tree-str">{JSON.stringify(node.scalar as string)}</span>;
    case 'number':
      return <span className="tree-num">{node.preview}</span>;
    case 'boolean':
      return <span className="tree-bool">{node.preview}</span>;
    case 'null':
      return <span className="tree-null">null</span>;
    default:
      return null;
  }
}

const PAGE_SIZE = 400;

export function TreeView({
  nodes,
  expanded,
  onToggle,
  search,
  matchedIds,
  selectedId,
  onSelect,
  onCopyPath,
  onCopyValue,
  onExpandAll,
  onCollapseAll,
  truncated = false,
}: TreeViewProps) {
  const searching = search.trim().length > 0;
  const visible = useMemo(
    () => computeVisible(nodes, expanded, searching, matchedIds),
    [nodes, expanded, searching, matchedIds],
  );

  // Windows grow lazily; rendering 20k rows at once would lock up the tab.
  const [limit, setLimit] = useState(PAGE_SIZE);
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [nodes, searching, search]);

  const rendered = visible.length > limit ? visible.slice(0, limit) : visible;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const moveSelection = (delta: number) => {
    if (visible.length === 0) return;
    const currentIndex = visible.findIndex((node) => node.id === selectedId);
    const nextIndex = Math.min(visible.length - 1, Math.max(0, (currentIndex === -1 ? 0 : currentIndex) + delta));
    const next = visible[nextIndex];
    if (next) onSelect(next.id);
  };

  if (nodes.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h4M4 12h4M4 18h4M10 6h10M10 12h10M10 18h10" />
          </svg>
        </div>
        <h3>暂无结构</h3>
        <p>粘贴有效的 JSON 后，这里会显示可展开的树形结构。</p>
      </div>
    );
  }

  return (
    <div className="tree">
      <div className="tree-toolbar">
        <button type="button" className="mini-btn" onClick={onExpandAll} data-testid="expand-all">
          全部展开
        </button>
        <button type="button" className="mini-btn" onClick={onCollapseAll} data-testid="collapse-all">
          全部折叠
        </button>
        <span className="tree-meta" style={{ opacity: 1 }} data-testid="tree-count">
          {visible.length} / {nodes.length} 行
        </span>
        {truncated ? (
          <span className="pill" title="节点数超过渲染上限，树只显示前一部分；统计数字仍然完整。">
            树已截断
          </span>
        ) : null}
      </div>

      <div
        role="tree"
        aria-label="JSON 结构树"
        tabIndex={0}
        ref={scrollRef}
        onKeyDown={(event) => {
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              moveSelection(1);
              break;
            case 'ArrowUp':
              event.preventDefault();
              moveSelection(-1);
              break;
            case 'ArrowRight': {
              const node = visible.find((item) => item.id === selectedId);
              if (node?.hasChildren && !expanded.has(node.id) && !searching) {
                event.preventDefault();
                onToggle(node.id);
              }
              break;
            }
            case 'ArrowLeft': {
              const node = visible.find((item) => item.id === selectedId);
              if (node?.hasChildren && !searching && expanded.has(node.id)) {
                event.preventDefault();
                onToggle(node.id);
              }
              break;
            }
            default:
              break;
          }
        }}
      >
        {rendered.map((node) => {
          const isOpen = searching ? node.hasChildren : expanded.has(node.id);
          const isMatched = matchedIds.has(node.id);
          const isSelected = selectedId === node.id;
          return (
            <div
              key={node.id}
              className={`tree-row${isMatched ? ' matched' : ''}${isSelected ? ' selected' : ''}`}
              style={{ paddingLeft: 6 + node.depth * 14 }}
              role="treeitem"
              aria-expanded={node.hasChildren ? isOpen : undefined}
              aria-level={node.depth + 1}
              aria-selected={isSelected}
              data-testid="tree-row"
              data-node-id={node.id}
              data-path={node.path}
              onClick={() => onSelect(node.id)}
            >
              <button
                type="button"
                className={`tree-toggle${node.hasChildren ? '' : ' leaf'}${isOpen ? ' open' : ''}`}
                aria-label={isOpen ? '折叠节点' : '展开节点'}
                data-testid="tree-toggle"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  if (node.hasChildren) onToggle(node.id);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>

              {node.key !== null ? (
                <>
                  <span className="tree-key">{JSON.stringify(node.key)}</span>
                  <span className="tree-punct">:</span>
                </>
              ) : node.index !== null ? (
                <>
                  <span className="tree-key idx">{node.index}</span>
                  <span className="tree-punct">:</span>
                </>
              ) : null}

              {node.isContainer ? (
                <span className={containerClass(node)}>
                  {node.type === 'object' ? '{' : '['}
                  {isOpen ? ` ${node.childCount} ${node.type === 'object' ? 'keys' : 'items'} ` : node.preview}
                  {node.type === 'object' ? '}' : ']'}
                </span>
              ) : (
                renderScalar(node)
              )}

              <span className="tree-meta">{node.path}</span>

              <span className="tree-actions">
                <button
                  type="button"
                  className="mini-btn"
                  title="复制节点路径"
                  data-testid="copy-path"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyPath(node);
                  }}
                >
                  路径
                </button>
                <button
                  type="button"
                  className="mini-btn"
                  title="复制节点值"
                  data-testid="copy-value"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyValue(node);
                  }}
                >
                  值
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {visible.length > limit ? (
        <div className="tree-more">
          <button
            type="button"
            className="mini-btn"
            onClick={() => setLimit((current) => current + PAGE_SIZE * 2)}
            data-testid="tree-more"
          >
            再显示 {Math.min(PAGE_SIZE * 2, visible.length - limit)} 行（共 {visible.length} 行）
          </button>
        </div>
      ) : null}
    </div>
  );
}
