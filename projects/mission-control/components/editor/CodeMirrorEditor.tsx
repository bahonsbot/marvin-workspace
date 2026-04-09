'use client';

import { useEffect, useRef } from 'react';

type CodeMirrorEditorProps = {
  filename: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function CodeMirrorEditor({ filename, value, readOnly = false, onChange, onSave }: CodeMirrorEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (textarea.value !== value) {
      textarea.value = value;
    }
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

      <textarea
        ref={textareaRef}
        defaultValue={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            onSave();
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 520,
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '18px 20px 26px',
          background: readOnly ? 'rgba(250, 246, 241, 0.75)' : 'transparent',
          color: readOnly ? '#6d675f' : 'var(--text-body)',
          fontSize: 14,
          lineHeight: 1.7,
          fontFamily: 'var(--font-mono), SFMono-Regular, ui-monospace, monospace',
          whiteSpace: 'pre',
          overflow: 'auto',
        }}
      />
    </div>
  );
}
