'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
import { EditorStatusBanner } from '@/components/editor/EditorStatusBanner';
import { FileConflictCompare } from '@/components/files/FileConflictCompare';
import { FilePreviewPanel } from '@/components/files/FilePreviewPanel';
import { FilesMetaStrip } from '@/components/files/FilesMetaStrip';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { FilesPreview } from '@/lib/types/contracts';

type FilesPreviewSectionProps = {
  initialPreview: FilesPreview | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function clonePreview(preview: FilesPreview | null) {
  return preview ? JSON.parse(JSON.stringify(preview)) as FilesPreview : null;
}

function isConflictMessage(message: string | null) {
  return Boolean(message && message.toLowerCase().includes('reload before saving'));
}

export function FilesPreviewSection({ initialPreview }: FilesPreviewSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<FilesPreview | null>(clonePreview(initialPreview));
  const [draft, setDraft] = useState(initialPreview?.textContent ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [conflictPreview, setConflictPreview] = useState<FilesPreview | null>(null);

  useEffect(() => {
    setPreview(clonePreview(initialPreview));
    setDraft(initialPreview?.textContent ?? '');
    setSaveState('idle');
    setMessage(null);
    setConflictPreview(null);
  }, [initialPreview]);

  useEffect(() => {
    if (!preview?.file?.path) return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#file-preview') return;

    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [preview?.file?.path]);

  const textFile = preview?.file?.kind === 'text' ? preview.file : null;
  const canEdit = Boolean(textFile?.writable);
  const dirty = Boolean(textFile) && draft !== (preview?.textContent ?? '');
  const conflict = isConflictMessage(message);
  const conflictText = conflictPreview?.file?.kind === 'text' ? (conflictPreview.textContent ?? '') : null;
  const hasConflictCompare = conflict && typeof conflictText === 'string';

  useUnsavedChangesGuard(dirty, {
    message: 'You have unsaved file edits in Mission Control. Leave without saving?',
  });

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

  function handleDraftChange(nextValue: string) {
    setDraft(nextValue);
    setSaveState((current) => (current === 'saved' ? 'idle' : current));
    setMessage((current) => (current === 'Saved' || current === 'Reloaded latest copy from disk.' || current === 'Loaded latest disk version.' || current === 'Overwrote newer disk version with your draft.' ? null : current));
  }

  async function reloadPreview() {
    if (!preview?.file?.path) return;

    setMessage(null);
    const response = await fetch(`/api/files/preview?path=${encodeURIComponent(preview.file.path)}`, { cache: 'no-store' });
    const data = await response.json() as FilesPreview;

    setPreview(data);
    setDraft(data.textContent ?? '');
    setSaveState('idle');
    setMessage('Reloaded latest copy from disk.');
    setConflictPreview(null);
  }

  async function saveAgainstVersion(targetPath: string, expectedMtimeMs: number | null, successMessage = 'Saved') {
    setSaveState('saving');
    setMessage(null);

    const response = await fetch('/api/files/write', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: targetPath,
        content: draft,
        expectedMtimeMs,
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
      setMessage(successMessage);
      setConflictPreview(null);
      return;
    }

    const errorData = await response.json().catch(() => ({ error: 'failed to save file' })) as { error?: string };
    if (response.status === 409) {
      try {
        const latestResponse = await fetch(`/api/files/preview?path=${encodeURIComponent(targetPath)}`, { cache: 'no-store' });
        if (latestResponse.ok) {
          const latest = await latestResponse.json() as FilesPreview;
          setConflictPreview(latest.file?.kind === 'text' ? latest : null);
        } else {
          setConflictPreview(null);
        }
      } catch {
        setConflictPreview(null);
      }
    } else {
      setConflictPreview(null);
    }
    setSaveState('error');
    setMessage(errorData.error ?? 'failed to save file');
  }

  async function saveDraft() {
    if (!textFile || !canEdit || !dirty || saveState === 'saving') return;
    await saveAgainstVersion(textFile.path, textFile.mtimeMs, 'Saved');
  }

  async function overwriteDraft() {
    if (!conflictPreview?.file || conflictPreview.file.kind !== 'text' || saveState === 'saving') return;
    await saveAgainstVersion(conflictPreview.file.path, conflictPreview.file.mtimeMs, 'Overwrote newer disk version with your draft.');
  }

  if (!preview || !preview.file) {
    return <FilePreviewPanel preview={null} />;
  }

  return (
    <div ref={sectionRef} id="file-preview" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
      <FilesMetaStrip
        path={preview.file.path}
        kind={preview.file.kind}
        size={preview.file.size}
        updatedAt={preview.file.updatedAt}
        previewable={preview.file.previewable}
        writable={preview.file.writable}
        dirty={dirty}
        saveState={saveState}
      />

      <FilePreviewPanel
        preview={preview}
        editor={editorPayload ? <CodeMirrorEditor {...editorPayload} onChange={handleDraftChange} onSave={saveDraft} /> : null}
        controls={
          editorPayload ? (
            <div style={{ display: 'grid', gap: 12 }}>
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

              {saveState === 'saving' ? (
                <EditorStatusBanner tone="neutral" title="Saving changes" detail="Mission Control is writing this file back to the workspace." />
              ) : conflict ? (
                <EditorStatusBanner tone="warning" title="Conflict detected" detail={message ?? 'This file changed on disk after you loaded it. Reload before saving again.'} />
              ) : saveState === 'error' ? (
                <EditorStatusBanner tone="danger" title="Save failed" detail={message ?? 'Mission Control could not save this file.'} />
              ) : !canEdit ? (
                <EditorStatusBanner tone="warning" title="Read-only file" detail={message ?? 'This file is outside the current writable scope, so editing stays visible but locked.'} />
              ) : dirty ? (
                <EditorStatusBanner tone="warning" title="Unsaved changes" detail="Your edits are local to this tab until you save." />
              ) : saveState === 'saved' ? (
                <EditorStatusBanner tone="success" title="Saved to workspace" detail={message ?? 'The latest version is now on disk.'} />
              ) : message ? (
                <EditorStatusBanner tone="neutral" title="Workspace refreshed" detail={message} />
              ) : null}

              {hasConflictCompare ? (
                <FileConflictCompare
                  draft={draft}
                  disk={conflictText ?? ''}
                  onOverwriteDraft={overwriteDraft}
                  onLoadDisk={() => {
                    const latest = conflictPreview;
                    const nextDisk = conflictText ?? '';
                    if (latest) {
                      setPreview(clonePreview(latest));
                    }
                    setDraft(nextDisk);
                    setSaveState('idle');
                    setMessage('Loaded latest disk version.');
                    setConflictPreview(null);
                  }}
                />
              ) : null}
            </div>
          ) : null
        }
      />
    </div>
  );
}
