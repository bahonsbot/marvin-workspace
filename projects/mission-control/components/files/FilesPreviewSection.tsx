'use client';

import { useEffect, useMemo, useState } from 'react';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
import { FilePreviewPanel } from '@/components/files/FilePreviewPanel';
import { FilesMetaStrip } from '@/components/files/FilesMetaStrip';
import type { FilesPreview } from '@/lib/types/contracts';

type FilesPreviewSectionProps = {
  initialPreview: FilesPreview | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function clonePreview(preview: FilesPreview | null) {
  return preview ? JSON.parse(JSON.stringify(preview)) as FilesPreview : null;
}

export function FilesPreviewSection({ initialPreview }: FilesPreviewSectionProps) {
  const [preview, setPreview] = useState<FilesPreview | null>(clonePreview(initialPreview));
  const [draft, setDraft] = useState(initialPreview?.textContent ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPreview(clonePreview(initialPreview));
    setDraft(initialPreview?.textContent ?? '');
    setSaveState('idle');
    setMessage(null);
  }, [initialPreview]);

  const textFile = preview?.file?.kind === 'text' ? preview.file : null;
  const canEdit = Boolean(textFile?.writable);
  const dirty = Boolean(textFile) && draft !== (preview?.textContent ?? '');

  const editorPayload = useMemo(
    () =>
      textFile
        ? {
            filename: textFile.name,
            value: draft,
            readOnly: !canEdit || saveState === 'saving',
          }
        : null,
    [canEdit, draft, saveState, textFile],
  );

  async function reloadPreview() {
    if (!preview?.file?.path) return;

    setMessage(null);
    const response = await fetch(`/api/files/preview?path=${encodeURIComponent(preview.file.path)}`, { cache: 'no-store' });
    const data = await response.json() as FilesPreview;

    setPreview(data);
    setDraft(data.textContent ?? '');
    setSaveState('idle');
  }

  async function saveDraft() {
    if (!textFile || !canEdit || !dirty || saveState === 'saving') return;

    setSaveState('saving');
    setMessage(null);

    const response = await fetch('/api/files/write', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: textFile.path,
        content: draft,
        expectedMtimeMs: textFile.mtimeMs,
      }),
    });

    if (response.ok) {
      const saved = await response.json() as { updatedAt: string; mtimeMs: number };
      setPreview((current) => {
        if (!current?.file) return current;
        return {
          ...current,
          refreshedAt: new Date().toISOString(),
          textContent: draft,
          file: {
            ...current.file,
            updatedAt: saved.updatedAt,
            mtimeMs: saved.mtimeMs,
          },
        };
      });
      setSaveState('saved');
      setMessage('Saved');
      return;
    }

    const errorData = await response.json().catch(() => ({ error: 'failed to save file' })) as { error?: string };
    setSaveState('error');
    setMessage(errorData.error ?? 'failed to save file');
  }

  if (!preview || !preview.file) {
    return <FilePreviewPanel preview={null} />;
  }

  return (
    <div id="file-preview" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
      <FilesMetaStrip
        path={preview.file.path}
        kind={preview.file.kind}
        size={preview.file.size}
        updatedAt={preview.file.updatedAt}
        previewable={preview.file.previewable}
      />

      <FilePreviewPanel
        preview={preview}
        editor={editorPayload ? <CodeMirrorEditor {...editorPayload} onChange={setDraft} onSave={saveDraft} /> : null}
        controls={
          editorPayload ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={!dirty || saveState === 'saving'}
                      className="floating-pill"
                      style={{ cursor: !dirty || saveState === 'saving' ? 'default' : 'pointer', opacity: !dirty || saveState === 'saving' ? 0.55 : 1 }}
                    >
                      {saveState === 'saving' ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(preview.textContent ?? '');
                        setSaveState('idle');
                        setMessage(null);
                      }}
                      disabled={!dirty || saveState === 'saving'}
                      className="floating-pill"
                      style={{ cursor: !dirty || saveState === 'saving' ? 'default' : 'pointer', opacity: !dirty || saveState === 'saving' ? 0.55 : 1 }}
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={reloadPreview} className="floating-pill" style={{ cursor: 'pointer' }}>
                  Reload
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                <span>{canEdit ? (dirty ? 'Unsaved changes' : 'Saved copy loaded') : 'Read-only preview'}</span>
                <span>{message ?? (canEdit ? 'Cmd/Ctrl+S to save' : 'Editing disabled for this file')}</span>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
