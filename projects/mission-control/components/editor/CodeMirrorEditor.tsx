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
          background: 'rgba(255, 253, 251, 0.88)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono), SFMono-Regular, ui-monospace, monospace' }}>{filename}</span>
        <span>{readOnly ? 'Read-only' : 'Editable'}</span>
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
          background: 'transparent',
          color: 'var(--text-body)',
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
