'use client';

import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, syntaxHighlighting } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { getLanguageExtension, shouldWrap } from '@/components/editor/languageMap';
import { missionControlEditorTheme, missionControlEditorHighlighting } from '@/components/editor/editorTheme';

type CodeMirrorEditorProps = {
  filename: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function CodeMirrorEditor({ filename, value, readOnly = false, onChange, onSave }: CodeMirrorEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartmentRef = useRef(new Compartment());
  const languageCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const syncedValueRef = useRef(value);

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    syncedValueRef.current = value;
  }, []);

  useEffect(() => {
    if (!editorContainerRef.current) return;

    let disposed = false;

    async function setupEditor() {
      const language = await getLanguageExtension(filename);
      if (disposed || !editorContainerRef.current) return;

      const extensions = [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        foldGutter(),
        drawSelection(),
        history(),
        bracketMatching(),
        indentOnInput(),
        search(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          {
            key: 'Mod-s',
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
        ]),
        missionControlEditorTheme,
        missionControlEditorHighlighting ?? syntaxHighlighting(defaultHighlightStyle),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const next = update.state.doc.toString();
          syncedValueRef.current = next;
          onChangeRef.current(next);
        }),
        readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnly)),
        languageCompartmentRef.current.of(language ?? []),
      ];

      if (shouldWrap(filename)) {
        extensions.push(EditorView.lineWrapping);
      }

      const state = EditorState.create({
        doc: value,
        extensions,
      });

      if (disposed || !editorContainerRef.current) return;

      if (viewRef.current) {
        viewRef.current.destroy();
      }

      viewRef.current = new EditorView({
        state,
        parent: editorContainerRef.current,
      });
    }

    setupEditor();

    return () => {
      disposed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [filename]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();

    if (value === currentDoc) {
      syncedValueRef.current = value;
      return;
    }

    // Ignore stale external values while local edits are in-flight.
    if (currentDoc !== syncedValueRef.current) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: value,
      },
    });

    syncedValueRef.current = value;
  }, [value]);

  return (
    <div
      style={{
        display: 'grid',
        minHeight: 0,
        height: '100%',
        gridTemplateRows: 'auto minmax(0, 1fr)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid rgba(200, 195, 188, 0.55)',
          color: 'var(--text-muted)',
          fontSize: 12,
          background: readOnly ? 'rgba(246, 240, 234, 0.94)' : 'rgba(255, 253, 251, 0.88)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono), SFMono-Regular, ui-monospace, monospace' }}>{filename}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 9px',
            borderRadius: 999,
            border: readOnly ? '1px solid rgba(157, 103, 55, 0.28)' : '1px solid rgba(63, 138, 113, 0.22)',
            background: readOnly ? 'rgba(255, 247, 240, 0.9)' : 'rgba(236, 248, 242, 0.85)',
            color: readOnly ? '#8a6338' : '#2e6a56',
            fontWeight: 700,
          }}
        >
          {readOnly ? 'Read-only' : 'Editable'}
        </span>
      </div>

      <div
        ref={editorContainerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 520,
          background: readOnly ? 'rgba(250, 246, 241, 0.75)' : 'transparent',
          color: readOnly ? '#6d675f' : 'var(--text-body)',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
