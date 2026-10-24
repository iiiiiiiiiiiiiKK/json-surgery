import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, XLogo } from './components/Icon';
import { JsonEditor, type JsonEditorHandle } from './components/JsonEditor';
import { TreeView } from './components/TreeView';
import { StatsPanel } from './components/StatsPanel';
import { QueryPanel } from './components/QueryPanel';
import { DiffPanel } from './components/DiffPanel';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { useTheme } from './hooks/useTheme';
import { useToasts } from './hooks/useToasts';
import { useJsonWorker } from './hooks/useJsonWorker';
import { analyzeText, diffText, formatText, queryText } from './lib/engine';
import { formatBytes } from './lib/format';
import { samePath, toTreePath } from './lib/paths';
import { SAMPLES } from './lib/samples';
import type { DiffResult } from './lib/diff';
import type { QueryResult } from './lib/query';
import type { JsonStats } from './lib/stats';
import type { ParseWarning } from './lib/parser';
import type { AnalyzeResponse, SerializedTreeNode } from './lib/protocol';

type SideTab = 'tree' | 'query' | 'stats' | 'diff';
type MobileView = 'editor' | 'side';

/** Files larger than this are rejected before reading, to protect memory. */
const MAX_FILE_BYTES = 32 * 1024 * 1024;
/** Documents larger than this only run the analysis after the user asks. */
const AUTO_ANALYZE_LIMIT = 2 * 1024 * 1024;

const INDENTS = [2, 4, 1, 0] as const;

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { toasts, push, dismiss } = useToasts();
  const { request, state: workerState } = useJsonWorker();

  const [text, setText] = useState('');
  const [rightText, setRightText] = useState('');
  const [tab, setTab] = useState<SideTab>('tree');
  const [mobileView, setMobileView] = useState<MobileView>('editor');
  const [sideOpen, setSideOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [indent, setIndent] = useState(2);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [nodes, setNodes] = useState<SerializedTreeNode[]>([]);
  const [stats, setStats] = useState<JsonStats | null>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffSideError, setDiffSideError] = useState<{
    left: { message: string; line: number; column: number } | null;
    right: { message: string; line: number; column: number } | null;
  }>({ left: null, right: null });

  const editorRef = useRef<JsonEditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const analyzeTimer = useRef<number | null>(null);
  const lastAnalyzedRef = useRef<string>('');

  // ---------------------------------------------------------------------
  // Analysis (worker first, main thread fallback)
  // ---------------------------------------------------------------------
  const runAnalyze = useCallback(
    async (source: string) => {
      if (!source.trim()) {
        setAnalysis(null);
        setNodes([]);
        setStats(null);
        setWarnings([]);
        setStale(false);
        return;
      }
      setBusy(true);
      setStale(false);
      // Mark the document as "analysing" *before* awaiting, so a late response
      // for a document the user already interacted with can be recognised and
      // does not wipe their tree selection.
      const previousSource = lastAnalyzedRef.current;
      lastAnalyzedRef.current = source;
      try {
        const response = await request({ type: 'analyze', text: source });
        const result: AnalyzeResponse =
          response && response.type === 'analyze' ? response : analyzeText(source);
        const isSameDocument = previousSource === source;
        setAnalysis(result);
        if (result.ok) {
          setNodes(result.nodes ?? []);
          setStats(result.stats ?? null);
          setWarnings(result.warnings ?? []);
          // Re-analysing the *same* document must not throw away the user's
          // expansion state or tree selection (e.g. after jumping from a query
          // hit while a background analysis is still in flight).
          if (!isSameDocument) {
            setExpanded(new Set(result.rootId ? [result.rootId] : []));
            setSelectedId(null);
          }
        } else {
          setNodes([]);
          setStats(null);
          setWarnings([]);
        }
      } catch {
        const fallback = analyzeText(source);
        const isSameDocument = previousSource === source;
        setAnalysis(fallback);
        if (fallback.ok) {
          setNodes(fallback.nodes ?? []);
          setStats(fallback.stats ?? null);
          setWarnings(fallback.warnings ?? []);
          if (!isSameDocument) {
            setExpanded(new Set(fallback.rootId ? [fallback.rootId] : []));
            setSelectedId(null);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [request],
  );

  useEffect(() => {
    if (!text.trim()) {
      setAnalysis(null);
      setNodes([]);
      setStats(null);
      setWarnings([]);
      setStale(false);
      return;
    }
    // Very large documents are not re-parsed on every keystroke: the user gets
    // an explicit "重新解析" action instead, which keeps typing smooth.
    if (text.length > AUTO_ANALYZE_LIMIT && lastAnalyzedRef.current !== text) {
      setStale(true);
      return;
    }
    if (analyzeTimer.current !== null) window.clearTimeout(analyzeTimer.current);
    analyzeTimer.current = window.setTimeout(() => {
      void runAnalyze(text);
    }, 240);
    return () => {
      if (analyzeTimer.current !== null) window.clearTimeout(analyzeTimer.current);
    };
  }, [text, runAnalyze]);

  // ---------------------------------------------------------------------
  // Diff (auto, debounced)
  // ---------------------------------------------------------------------
  const runDiff = useCallback(
    async (left: string, right: string) => {
      if (!left.trim() || !right.trim()) {
        setDiffResult(null);
        setDiffError(null);
        setDiffSideError({ left: null, right: null });
        return;
      }
      try {
        const response = await request({ type: 'diff', text: left, rightText: right });
        if (response && response.type === 'diff') {
          setDiffResult(response.result);
          setDiffError(response.error ?? null);
          setDiffSideError({ left: response.leftError ?? null, right: response.rightError ?? null });
          return;
        }
        const fallback = diffText(left, right);
        setDiffResult(fallback.result);
        setDiffError(fallback.error ?? null);
        setDiffSideError({ left: fallback.leftError ?? null, right: fallback.rightError ?? null });
      } catch {
        const fallback = diffText(left, right);
        setDiffResult(fallback.result);
        setDiffError(fallback.error ?? null);
      }
    },
    [request],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runDiff(text, rightText);
    }, 340);
    return () => window.clearTimeout(timer);
  }, [text, rightText, runDiff]);

  // ---------------------------------------------------------------------
  // Toolbar actions
  // ---------------------------------------------------------------------
  const applyFormat = useCallback(
    async (mode: 'pretty' | 'minify' | 'sort') => {
      if (!text.trim()) {
        push('编辑器是空的，没有可处理的内容', 'info');
        return;
      }
      setBusy(true);
      try {
        const response = await request({
          type: 'format',
          text,
          mode,
          indent,
          sortKeys: mode === 'sort',
        });
        let output: string | undefined;
        let error: string | undefined;
        if (response && response.type === 'format') {
          output = response.ok ? response.text : undefined;
          error = response.ok ? undefined : response.error;
        } else {
          const fallback = formatText(text, mode, indent, mode === 'sort');
          output = fallback.ok ? fallback.text : undefined;
          error = fallback.ok ? undefined : fallback.error;
        }
        if (!output) {
          push(error ? `无法处理：${error}` : '格式化失败：JSON 无效', 'error');
          return;
        }
        setText(output);
        push(
          mode === 'minify'
            ? '已压缩 JSON'
            : mode === 'sort'
              ? '已按键名排序（数组顺序保持不变）'
              : '已格式化 JSON',
          'success',
        );
      } finally {
        setBusy(false);
      }
    },
    [text, indent, request, push],
  );

  const copyText = useCallback(
    async (value: string, label: string) => {
      if (!value) {
        push('没有可复制的内容', 'info');
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        push(`${label}已复制到剪贴板`, 'success');
      } catch {
        // Fallback for browsers without the async clipboard API (or non-secure origins).
        try {
          const area = document.createElement('textarea');
          area.value = value;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(area);
          push(ok ? `${label}已复制到剪贴板` : '复制失败，请手动选择内容', ok ? 'success' : 'error');
        } catch {
          push('复制失败，请手动选择内容', 'error');
        }
      }
    },
    [push],
  );

  const downloadJson = useCallback(() => {
    if (!text.trim()) {
      push('编辑器是空的，没有可下载的内容', 'info');
      return;
    }
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    anchor.href = url;
    anchor.download = fileName ? fileName.replace(/\.json$/i, '') + `-${stamp}.json` : `json-surgery-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke on the next tick so Safari has time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    push('已开始下载 .json 文件', 'success');
  }, [text, fileName, push]);

  const clearAll = useCallback(() => {
    setText('');
    setRightText('');
    setAnalysis(null);
    setNodes([]);
    setStats(null);
    setWarnings([]);
    setQueryResult(null);
    setDiffResult(null);
    setDiffError(null);
    setExpanded(new Set());
    setSelectedId(null);
    setSearch('');
    setFileName(null);
    setStale(false);
    lastAnalyzedRef.current = '';
    editorRef.current?.focus();
    push('已清空编辑器', 'info');
  }, [push]);

  const loadSample = useCallback(
    (index = 0) => {
      const sample = SAMPLES[index] ?? SAMPLES[0]!;
      setText(sample.text);
      setRightText('');
      setFileName(null);
      push(`已加载示例：${sample.name}`, 'success');
    },
    [push],
  );

  const openFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_BYTES) {
        push(`文件过大（${formatBytes(file.size)}），上限为 ${formatBytes(MAX_FILE_BYTES)}`, 'error');
        return;
      }
      try {
        const content = await file.text();
        setText(content);
        setFileName(file.name);
        push(`已载入 ${file.name}（${formatBytes(file.size)}）`, 'success');
      } catch {
        push('读取文件失败：文件可能已被移动或没有权限', 'error');
      }
    },
    [push],
  );

  // ---------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  // ---------------------------------------------------------------------
  // Global keyboard shortcuts
  // ---------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) {
        if (event.key === 'Escape') setShortcutsOpen(false);
        return;
      }
      const key = event.key.toLowerCase();

      if (event.shiftKey) {
        switch (key) {
          case 'f':
            event.preventDefault();
            void applyFormat('pretty');
            return;
          case 'm':
            event.preventDefault();
            void applyFormat('minify');
            return;
          case 's':
            event.preventDefault();
            void applyFormat('sort');
            return;
          case 'c':
            event.preventDefault();
            void copyText(text, '全部内容');
            return;
          case 'd':
            event.preventDefault();
            downloadJson();
            return;
          case 'k':
            event.preventDefault();
            clearAll();
            return;
          case 'o':
            event.preventDefault();
            openFile();
            return;
          case 't':
            event.preventDefault();
            toggleTheme();
            return;
          case 'u':
            event.preventDefault();
            loadSample(0);
            return;
          case 'z':
            event.preventDefault();
            editorRef.current?.redo();
            return;
          default:
            return;
        }
      }

      if (key === 'z') {
        // Let CodeMirror handle undo when it has focus; otherwise use the handle.
        if (!editorRef.current?.undo()) return;
        event.preventDefault();
        return;
      }
      if (key === 'b') {
        event.preventDefault();
        setSideOpen((open) => !open);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        void runAnalyze(text);
        return;
      }
      if (key === '1') {
        event.preventDefault();
        setTab('tree');
        return;
      }
      if (key === '2') {
        event.preventDefault();
        setTab('query');
        return;
      }
      if (key === '3') {
        event.preventDefault();
        setTab('stats');
        return;
      }
      if (key === '4') {
        event.preventDefault();
        setTab('diff');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyFormat, copyText, text, downloadJson, clearAll, openFile, toggleTheme, loadSample, runAnalyze]);

  // ---------------------------------------------------------------------
  // Tree helpers
  // ---------------------------------------------------------------------
  const matchedIds = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const ids = new Set<string>();
    if (!needle) return ids;
    for (const node of nodes) {
      if (node.key && node.key.toLowerCase().includes(needle)) {
        ids.add(node.id);
        continue;
      }
      const scalar = node.scalar;
      if (typeof scalar === 'string' && scalar.toLowerCase().includes(needle)) ids.add(node.id);
      else if (typeof scalar === 'number' && String(scalar).includes(needle)) ids.add(node.id);
      else if (typeof scalar === 'boolean' && String(scalar).includes(needle)) ids.add(node.id);
      else if (node.type === 'null' && 'null'.includes(needle)) ids.add(node.id);
    }
    return ids;
  }, [nodes, search]);

  const toggleNode = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(nodes.filter((node) => node.hasChildren).map((node) => node.id)));
  }, [nodes]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const copyNodePath = useCallback(
    (node: SerializedTreeNode) => {
      void copyText(node.path, '节点路径');
    },
    [copyText],
  );

  const copyNodeValue = useCallback(
    (node: SerializedTreeNode) => {
      if (node.isContainer) {
        push('容器节点请用「路径」定位，或在编辑器里选中文档片段', 'info');
        return;
      }
      void copyText(node.scalar === null ? 'null' : String(node.scalar), '节点值');
    },
    [copyText, push],
  );

  const runQuery = useCallback(
    async (expression: string) => {
      if (!text.trim()) {
        push('请先输入 JSON 再执行查询', 'info');
        return;
      }
      setBusy(true);
      try {
        const response = await request({ type: 'query', text, query: expression });
        const result = response && response.type === 'query' ? response.result : queryText(text, expression);
        setQueryResult(result);
        setTab('query');
        setMobileView('side');
      } finally {
        setBusy(false);
      }
    },
    [request, text, push],
  );

  // Jump from a query hit straight to the matching tree row.
  const locateInTree = useCallback(
    (path: string) => {
      const target = toTreePath(path) ?? path;
      const node = nodes.find((item) => item.path === target) ?? nodes.find((item) => samePath(item.path, path));
      if (!node) {
        push('树中未找到该路径（可能超出树的渲染上限）', 'info');
        return;
      }
      setExpanded((current) => {
        const next = new Set(current);
        const byId = new Map(nodes.map((item) => [item.id, item] as const));
        let parentId = node.parentId;
        while (parentId) {
          next.add(parentId);
          parentId = byId.get(parentId)?.parentId ?? null;
        }
        if (node.hasChildren) next.add(node.id);
        return next;
      });
      setSelectedId(node.id);
      setSearch('');
      setTab('tree');
      setMobileView('side');
    },
    [nodes, push],
  );

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  const error = analysis && !analysis.ok ? analysis.error : null;
  const charCount = text.length;
  const byteCount = useMemo(() => new Blob([text]).size, [text]);
  const lineCount = text ? text.split('\n').length : 0;
  const valid = Boolean(analysis?.ok) && !stale;

  const tabs: Array<{ id: SideTab; label: string; icon: 'tree' | 'search' | 'chart' | 'diff'; count?: number }> = [
    { id: 'tree', label: '树形', icon: 'tree' },
    { id: 'query', label: '查询', icon: 'search' },
    { id: 'stats', label: '统计', icon: 'chart' },
    { id: 'diff', label: 'Diff', icon: 'diff', count: diffResult && diffResult.summary.total > 0 ? diffResult.summary.total : undefined },
  ];

  const sidePanel = (
    <div className="pane pane-side">
      <div className="panel-tabs" role="tablist" aria-label="结果面板">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
            role="tab"
            aria-selected={tab === item.id}
            data-testid={`tab-${item.id}`}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
            {item.count ? <span className="count">{item.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {tab === 'tree' ? (
          <>
            <div className="tree-toolbar">
              <input
                className="input"
                placeholder="搜索键或值…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="搜索 JSON 键或值"
                data-testid="tree-search"
                spellCheck={false}
              />
              {search ? <span className="pill">{matchedIds.size} 个匹配</span> : null}
            </div>
            <TreeView
              nodes={nodes}
              expanded={expanded}
              onToggle={toggleNode}
              search={search}
              matchedIds={matchedIds}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCopyPath={copyNodePath}
              onCopyValue={copyNodeValue}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              truncated={analysis?.truncated}
            />
          </>
        ) : null}

        {tab === 'query' ? (
          <QueryPanel
            result={queryResult}
            running={busy}
            onRun={runQuery}
            onCopy={(value) => void copyText(value, '查询结果')}
            onLocate={locateInTree}
          />
        ) : null}

        {tab === 'stats' ? <StatsPanel stats={stats} length={charCount} bytes={byteCount} /> : null}

        {tab === 'diff' ? (
          <DiffPanel
            result={diffResult}
            error={diffError}
            leftError={diffSideError.left}
            rightError={diffSideError.right}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {'{ }'}
          </span>
          <span className="brand-text">
            <span className="brand-title">JSON Surgery</span>
            <span className="brand-sub">本地运行的 JSON 手术室</span>
          </span>
        </div>

        <div className="header-actions">
          <div className="tool-group">
            <button
              type="button"
              className="btn"
              onClick={() => void applyFormat('pretty')}
              disabled={!text.trim()}
              title="格式化 (Ctrl+Shift+F)"
              data-testid="btn-format"
            >
              <Icon name="format" size={15} />
              <span className="btn-label">格式化</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void applyFormat('minify')}
              disabled={!text.trim()}
              title="压缩 (Ctrl+Shift+M)"
              data-testid="btn-minify"
            >
              <Icon name="minify" size={15} />
              <span className="btn-label">压缩</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void applyFormat('sort')}
              disabled={!text.trim()}
              title="按键名排序，数组顺序不变 (Ctrl+Shift+S)"
              data-testid="btn-sort"
            >
              <Icon name="sort" size={15} />
              <span className="btn-label">排序</span>
            </button>
          </div>

          <div className="tool-group">
            <button
              type="button"
              className="btn"
              onClick={() => void copyText(text, '全部内容')}
              disabled={!text.trim()}
              title="复制全部 (Ctrl+Shift+C)"
              data-testid="btn-copy"
            >
              <Icon name="copy" size={15} />
              <span className="btn-label">复制</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={downloadJson}
              disabled={!text.trim()}
              title="下载 .json (Ctrl+Shift+D)"
              data-testid="btn-download"
            >
              <Icon name="download" size={15} />
              <span className="btn-label">下载</span>
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={clearAll}
              disabled={!text && !rightText}
              title="清空 (Ctrl+Shift+K)"
              data-testid="btn-clear"
            >
              <Icon name="trash" size={15} />
              <span className="btn-label">清空</span>
            </button>
          </div>

          <div className="tool-group">
            <button type="button" className="btn" onClick={openFile} title="打开本地文件 (Ctrl+Shift+O)" data-testid="btn-open">
              <Icon name="folder" size={15} />
              <span className="btn-label">打开</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => loadSample(0)}
              title="加载示例数据 (Ctrl+Shift+U)"
              data-testid="btn-sample"
            >
              <Icon name="sparkles" size={15} />
              <span className="btn-label">示例</span>
            </button>
          </div>

          <div className="tool-group">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => editorRef.current?.undo()}
              title="撤销 (Ctrl+Z)"
              aria-label="撤销"
              data-testid="btn-undo"
            >
              <Icon name="undo" size={15} />
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => editorRef.current?.redo()}
              title="重做 (Ctrl+Shift+Z)"
              aria-label="重做"
              data-testid="btn-redo"
            >
              <Icon name="redo" size={15} />
            </button>
          </div>
          <div className="tool-group">
            <label className="indent-field" title="缩进空格数">
              <span className="indent-label">缩进</span>
              <select
                className="select"
                value={indent}
                onChange={(event) => setIndent(Number(event.target.value))}
                aria-label="缩进空格数"
                data-testid="indent-select"
              >
                {INDENTS.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? 'Tab' : value}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`btn${sideOpen ? ' active' : ''}`}
              onClick={() => setSideOpen((open) => !open)}
              title="显示 / 隐藏右侧面板 (Ctrl+B)"
              aria-label="显示 / 隐藏右侧面板"
              data-testid="btn-panel"
            >
              <Icon name="panel" size={15} />
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setShortcutsOpen(true)}
              title="键盘快捷键"
              aria-label="键盘快捷键"
              data-testid="btn-shortcuts"
            >
              <Icon name="keyboard" size={15} />
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={toggleTheme}
              title="切换主题 (Ctrl+Shift+T)"
              aria-label="切换深色 / 浅色主题"
              data-testid="btn-theme"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            </button>
          </div>

          <a
            className="x-link"
            href="https://x.com/0xkillcoin"
            target="_blank"
            rel="noopener noreferrer"
            title="作者 @0xkillcoin"
            aria-label="作者 𝕏：@0xkillcoin"
            data-testid="author-link"
          >
            <XLogo size={13} />
            <span className="x-text">@0xkillcoin</span>
          </a>
        </div>
      </header>

      <div className="mobile-tabs" role="tablist" aria-label="移动端视图切换">
        <button
          type="button"
          className={`tab${mobileView === 'editor' ? ' active' : ''}`}
          onClick={() => setMobileView('editor')}
          role="tab"
          aria-selected={mobileView === 'editor'}
          data-testid="mobile-tab-editor"
        >
          <Icon name="code" size={14} />
          编辑器
        </button>
        <button
          type="button"
          className={`tab${mobileView === 'side' ? ' active' : ''}`}
          onClick={() => setMobileView('side')}
          role="tab"
          aria-selected={mobileView === 'side'}
          data-testid="mobile-tab-side"
        >
          <Icon name="tree" size={14} />
          结果面板
        </button>
      </div>

      {error ? (
        <div className="error-banner" role="alert" data-testid="error-banner">
          <Icon name="alert" size={15} />
          <span className="loc" data-testid="error-location">
            第 {error.line} 行 · 第 {error.column} 列
          </span>
          <span className="msg">{error.message}</span>
          <button
            type="button"
            onClick={() => editorRef.current?.goToLine(error.line, error.column)}
            title="跳转到错误位置"
            data-testid="error-goto"
          >
            跳转
          </button>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="warn-banner" data-testid="warn-banner">
          <Icon name="alert" size={15} />
          <span className="msg">
            有效 JSON，但有 {warnings.length} 条提示：{warnings[0]!.message}
          </span>
        </div>
      ) : null}

      {stale ? (
        <div className="warn-banner" data-testid="stale-banner">
          <Icon name="refresh" size={15} />
          <span className="msg">文档较大，已暂停自动解析。</span>
          <button type="button" className="mini-btn" onClick={() => void runAnalyze(text)}>
            重新解析
          </button>
        </div>
      ) : null}

      <div
        className={`workspace${tab === 'diff' ? ' workspace-diff' : ''}`}
        data-mobile-view={mobileView}
        data-side={sideOpen ? 'open' : 'closed'}
      >
        {tab === 'diff' ? (
          <>
            <div className="split">
              <div className="pane">
                <div className="editor-head">
                  <span className="editor-title">
                    <span className="dot" /> 原始
                  </span>
                  <span className="spacer" />
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setRightText(text)}
                    disabled={!text}
                    title="把左侧内容复制到右侧"
                  >
                    复制到右侧 →
                  </button>
                </div>
                <JsonEditor
                  value={text}
                  onChange={setText}
                  handleRef={(handle) => {
                    editorRef.current = handle;
                  }}
                  ariaLabel="左侧 JSON 编辑器"
                  placeholder={'粘贴原始 JSON…'}
                />
              </div>
              <div className="pane">
                <div className="editor-head">
                  <span className="editor-title">
                    <span className="dot warn" /> 对比
                  </span>
                  <span className="spacer" />
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setText(rightText)}
                    disabled={!rightText}
                    title="把右侧内容复制到左侧"
                  >
                    ← 复制到左侧
                  </button>
                </div>
                <JsonEditor
                  value={rightText}
                  onChange={setRightText}
                  handleRef={() => undefined}
                  ariaLabel="右侧 JSON 编辑器"
                  placeholder={'粘贴修改后的 JSON…'}
                />
              </div>
            </div>
            {sideOpen ? sidePanel : null}
          </>
        ) : (
          <>
            <div className="pane pane-editor">
              <div className="editor-head">
                <span className={`dot${error ? ' err' : valid ? '' : ' warn'}`} />
                <span className="editor-title">{fileName ?? 'JSON 编辑器'}</span>
                <span className="spacer" />
                {busy ? <span className="status-busy">处理中…</span> : null}
                {valid ? <span className="status-ok">✓ 语法有效</span> : null}
                {analysis?.elapsedMs !== undefined && !busy ? (
                  <span style={{ color: 'var(--text-faint)' }}>{analysis.elapsedMs} ms</span>
                ) : null}
              </div>
              <JsonEditor
                value={text}
                onChange={setText}
                onSave={() => void applyFormat('pretty')}
                onRun={() => void runAnalyze(text)}
                handleRef={(handle) => {
                  editorRef.current = handle;
                }}
                ariaLabel="JSON 编辑器"
                placeholder={'在此粘贴 JSON，或把 .json 文件拖进窗口…'}
                errorLine={error?.line ?? null}
                errorColumn={error?.column ?? null}
              />
            </div>
            {sideOpen ? sidePanel : null}
          </>
        )}
      </div>

      <footer className="statusbar">
        <span className="status-item">
          <b>{charCount.toLocaleString('zh-CN')}</b> 字符
        </span>
        <span className="status-item">
          <b>{formatBytes(byteCount)}</b>
        </span>
        <span className="status-item">
          <b>{lineCount.toLocaleString('zh-CN')}</b> 行
        </span>
        <span className="status-item">
          {error ? (
            <span className="status-error" data-testid="status-error">
              <Icon name="alert" size={12} /> 第 {error.line} 行第 {error.column} 列
            </span>
          ) : valid ? (
            <span className="status-ok" data-testid="status-valid">
              <Icon name="check" size={12} /> JSON 有效
            </span>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>等待输入</span>
          )}
        </span>
        {stats ? (
          <span className="status-item">
            深度 <b>{stats.maxDepth}</b>
          </span>
        ) : null}
        {stats ? (
          <span className="status-item">
            节点 <b>{stats.totalNodes.toLocaleString('zh-CN')}</b>
          </span>
        ) : null}
        <span className={`status-item ${workerState === 'ready' ? 'status-ok' : ''}`} data-testid="status-worker">
          {workerState === 'ready' ? 'Worker 就绪' : workerState === 'starting' ? 'Worker 启动中' : '主线程模式'}
        </span>

        <span className="status-right">
          <span className="status-item" title="所有解析均在浏览器本地完成，没有任何网络请求">
            <Icon name="info" size={12} /> 100% 本地运行 · 数据不上传
          </span>
          <a
            className="status-item status-link"
            href="https://x.com/0xkillcoin"
            target="_blank"
            rel="noopener noreferrer"
          >
            𝕏 @0xkillcoin
          </a>
        </span>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,.txt,text/plain"
        style={{ display: 'none' }}
        data-testid="file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />

      {dragging ? (
        <div className="dropzone" data-testid="dropzone">
          <div className="dropzone-inner">
            <Icon name="upload" size={28} />
            <h3>松开以载入 JSON 文件</h3>
            <p>文件只在本地读取，不会被上传</p>
          </div>
        </div>
      ) : null}

      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`} onClick={() => dismiss(toast.id)}>
            <Icon name={toast.kind === 'error' ? 'alert' : toast.kind === 'info' ? 'info' : 'check'} size={14} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
