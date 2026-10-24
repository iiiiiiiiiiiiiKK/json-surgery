import { useEffect, useRef } from 'react';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
  dropCursor,
  placeholder as placeholderExt,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, isolateHistory, redo, redoDepth, undo, undoDepth } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  foldKeymap,
  indentUnit,
} from '@codemirror/language';
import { lintKeymap, linter, type Diagnostic } from '@codemirror/lint';
import { tags as t } from '@lezer/highlight';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { parseJson } from '../lib/parser';

const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--accent-2)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--success)' },
  { tag: t.number, color: 'var(--warning)' },
  { tag: [t.bool, t.null], color: 'var(--danger)' },
  { tag: t.punctuation, color: 'var(--text-faint)' },
  { tag: t.bracket, color: 'var(--text-muted)' },
]);

const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--text)',
    backgroundColor: 'transparent',
    height: '100%',
  },
  '.cm-content': {
    padding: '10px 0',
  },
  '.cm-line': {
    padding: '0 12px',
  },
  '.cm-gutterElement': {
    padding: '0 8px 0 12px',
  },
});

const readOnlyCompartment = new Compartment();
const placeholderCompartment = new Compartment();

export interface JsonEditorHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  goToLine: (line: number, column: number) => void;
  insert: (value: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onRun?: () => void;
  handleRef?: (handle: JsonEditorHandle | null) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  errorLine?: number | null;
  errorColumn?: number | null;
}

/**
 * CodeMirror 6 based JSON editor.
 * Exposes an imperative handle so the toolbar can format / clear / focus.
 */
export function JsonEditor({
  value,
  onChange,
  onSave,
  onRun,
  handleRef,
  readOnly = false,
  ariaLabel = 'JSON 编辑器',
  placeholder,
  errorLine = null,
  errorColumn = null,
}: JsonEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onRunRef.current = onRun;

  // --- create the editor once -------------------------------------------
  useEffect(() => {
    if (!hostRef.current) return;

    const jsonLinter = linter((view) => {
      const doc = view.state.doc.toString();
      if (!doc.trim()) return [];
      const result = parseJson(doc);
      if (result.ok) return [];
      const line = result.error.line;
      const column = result.error.column;
      const lineInfo = view.state.doc.line(Math.min(line, view.state.doc.lines));
      const from = lineInfo.from + Math.max(0, column - 1);
      const to = Math.min(view.state.doc.length, from + 1);
      const diagnostic: Diagnostic = {
        from,
        to: Math.max(from, to),
        severity: 'error',
        message: result.error.message,
        source: 'json-surgery',
      };
      return [diagnostic];
    });

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({ openText: '▾', closedText: '▸' }),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of('  '),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      syntaxHighlighting(jsonHighlight),
      json(),
      jsonLinter,
      search({ top: true }),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
      placeholderCompartment.of(placeholderExt(placeholder ?? '')),
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onSaveRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-Enter',
          preventDefault: true,
          run: () => {
            onRunRef.current?.();
            return true;
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      editorTheme,
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: hostRef.current,
    });
    viewRef.current = view;

    const handle: JsonEditorHandle = {
      focus: () => view.focus(),
      getValue: () => view.state.doc.toString(),
      setValue: (next: string) => {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
          // Each programmatic replacement (format, sample, clear) becomes its own
          // undo step instead of being merged with the previous edit.
          annotations: isolateHistory.of('full'),
        });
      },
      goToLine: (line: number, column: number) => {
        const doc = view.state.doc;
        const safeLine = Math.min(Math.max(1, line), doc.lines);
        const lineInfo = doc.line(safeLine);
        const pos = Math.min(lineInfo.from + Math.max(0, column - 1), lineInfo.to);
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
        view.focus();
      },
      insert: (next: string) => {
        const { from, to } = view.state.selection.main;
        view.dispatch({ changes: { from, to, insert: next }, selection: { anchor: from + next.length } });
        view.focus();
      },
      undo: () => undo({ state: view.state, dispatch: (tr) => view.dispatch(tr) }),
      redo: () => redo({ state: view.state, dispatch: (tr) => view.dispatch(tr) }),
      canUndo: () => undoDepth(view.state) > 0,
      canRedo: () => redoDepth(view.state) > 0,
    };
    handleRef?.(handle);

    return () => {
      handleRef?.(null);
      viewRef.current = null;
      view.destroy();
    };
    // The editor is created once; `value` is synced through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- keep external value in sync (only when it actually differs) ------
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      // Format / sample / clear each become their own undo step, so Ctrl+Z
      // walks back through them one action at a time.
      annotations: isolateHistory.of('full'),
    });
  }, [value]);

  // --- jump to the error position ---------------------------------------
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !errorLine) return;
    const doc = view.state.doc;
    const safeLine = Math.min(Math.max(1, errorLine), doc.lines);
    const lineInfo = doc.line(safeLine);
    const pos = Math.min(lineInfo.from + Math.max(0, (errorColumn ?? 1) - 1), lineInfo.to);
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
  }, [errorLine, errorColumn]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: placeholderCompartment.reconfigure(placeholderExt(placeholder ?? '')),
    });
  }, [placeholder]);

  return <div className="editor-host" ref={hostRef} data-testid="json-editor" aria-label={ariaLabel} />;
}
