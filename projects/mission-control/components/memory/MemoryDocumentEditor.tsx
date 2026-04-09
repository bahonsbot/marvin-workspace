'use client';

import { useEffect, useMemo, useState } from 'react';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
import { EditorStatusBanner } from '@/components/editor/EditorStatusBanner';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { DocumentContent } from '@/components/memory/DocumentContent';
import type { LearningKind, MemoryDocument, MemorySection } from '@/lib/types/contracts';

type MemoryDocumentEditorProps = {
  initialDocument: MemoryDocument;
  section: MemorySection;
  selectedDate: string | null;
  selectedLearning: LearningKind | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type MemoryDocumentResponse = {
  section: MemorySection;
  selectedDate: string | null;
  selectedLearning: LearningKind | null;
  document: MemoryDocument;
};

function isConflictMessage(message: string | null) {
  return Boolean(message && message.toLowerCase().includes('reload before saving'));
}

function buildDocumentUrl(params: { section: MemorySection; selectedDate: string | null; selectedLearning: LearningKind | null }) {
  const searchParams = new URLSearchParams();
  searchParams.set('section', params.section);

  if (params.section === 'daily' && params.selectedDate) {
    searchParams.set('date', params.selectedDate);
  }

  if (params.section === 'learnings' && params.selectedLearning) {
    searchParams.set('learning', params.selectedLearning);
  }

  return `/api/memory/document?${searchParams.toString()}`;
}

export function MemoryDocumentEditor({
  initialDocument,
  section,
  selectedDate,
  selectedLearning,
}: MemoryDocumentEditorProps) {
  const [document, setDocument] = useState(initialDocument);
  const [draft, setDraft] = useState(initialDocument.content);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDocument(initialDocument);
    setDraft(initialDocument.content);
    setSaveState('idle');
    setMessage(null);
  }, [initialDocument]);

  const canEdit = document.writable;
  const dirty = draft !== document.content;
  const conflict = isConflictMessage(message);
  const filename = useMemo(() => document.path.split('/').pop() || document.title || 'memory.md', [document.path, document.title]);

  useUnsavedChangesGuard(dirty, {
    message: 'You have unsaved memory edits in Mission Control. Leave without saving?',
  });

  function handleDraftChange(nextValue: string) {
    setDraft(nextValue);
    setSaveState((current) => (current === 'saved' ? 'idle' : current));
    setMessage((current) => (current === 'Saved' || current === 'Created and saved' || current === 'Reloaded latest memory copy.' ? null : current));
  }

  async function reloadDocument() {
    setMessage(null);

    const response = await fetch(
      buildDocumentUrl({
        section,
        selectedDate,
        selectedLearning,
      }),
      { cache: 'no-store' },
    );

    if (!response.ok) {
      setSaveState('error');
      setMessage('failed to reload memory document');
      return;
    }

    const data = (await response.json()) as MemoryDocumentResponse;
    setDocument(data.document);
    setDraft(data.document.content);
    setSaveState('idle');
    setMessage('Reloaded latest memory copy.');
  }

  async function saveDraft() {
    if (!canEdit || !dirty || saveState === 'saving') return;

    setSaveState('saving');
    setMessage(null);

    const response = await fetch('/api/memory/document', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section,
        date: selectedDate,
        learning: selectedLearning,
        content: draft,
        expectedMtimeMs: document.mtimeMs,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as MemoryDocumentResponse;
      const wasMissing = !document.exists;
      setDocument(data.document);
      setDraft(data.document.content);
      setSaveState('saved');
      setMessage(wasMissing ? 'Created and saved' : 'Saved');
      return;
    }

    const errorData = (await response.json().catch(() => ({ error: 'failed to save memory document' }))) as { error?: string };
    setSaveState('error');
    setMessage(errorData.error ?? 'failed to save memory document');
  }

  return (
    <DocumentContent
      content={document.content}
      exists={document.exists}
      controls={
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveDraft}
                disabled={!dirty || !canEdit || saveState === 'saving'}
                className="floating-pill"
                style={{ cursor: !dirty || !canEdit || saveState === 'saving' ? 'default' : 'pointer', opacity: !dirty || !canEdit || saveState === 'saving' ? 0.55 : 1 }}
              >
                {saveState === 'saving' ? 'Saving…' : document.exists ? 'Save' : 'Create file'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(document.content);
                  setSaveState('idle');
                  setMessage(null);
                }}
                disabled={!dirty || saveState === 'saving'}
                className="floating-pill"
                style={{ cursor: !dirty || saveState === 'saving' ? 'default' : 'pointer', opacity: !dirty || saveState === 'saving' ? 0.55 : 1 }}
              >
                Cancel
              </button>
              <button type="button" onClick={reloadDocument} className="floating-pill" style={{ cursor: 'pointer' }}>
                Reload
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
              <span>{!document.exists ? (dirty ? 'Draft ready to create' : 'File not created yet') : canEdit ? (dirty ? 'Unsaved changes' : 'Saved copy loaded') : 'Read-only memory'}</span>
              <span>{message ?? (!document.exists ? 'Edit and save to create this file' : canEdit ? 'Cmd/Ctrl+S to save' : 'Editing disabled for this document')}</span>
            </div>
          </div>

          {saveState === 'saving' ? (
            <EditorStatusBanner tone="neutral" title="Saving memory" detail="Mission Control is writing this document back into the workspace memory layer." />
          ) : conflict ? (
            <EditorStatusBanner tone="warning" title="Conflict detected" detail={message ?? 'This memory document changed on disk after you loaded it. Reload before saving again.'} />
          ) : saveState === 'error' ? (
            <EditorStatusBanner tone="danger" title="Save failed" detail={message ?? 'Mission Control could not save this memory document.'} />
          ) : !canEdit ? (
            <EditorStatusBanner tone="warning" title="Read-only memory" detail={message ?? 'This memory target is visible here, but editing is currently disabled.'} />
          ) : !document.exists ? (
            <EditorStatusBanner tone="warning" title="Ready to create" detail={dirty ? 'This document does not exist yet. Saving will create it.' : 'This memory slot is missing right now. Start editing, then save to create it.'} />
          ) : dirty ? (
            <EditorStatusBanner tone="warning" title="Unsaved changes" detail="Your edits are local to this tab until you save." />
          ) : saveState === 'saved' ? (
            <EditorStatusBanner tone="success" title={document.exists ? 'Saved to memory' : 'Created and saved'} detail={message ?? 'The latest version is now on disk.'} />
          ) : message ? (
            <EditorStatusBanner tone="neutral" title="Memory refreshed" detail={message} />
          ) : null}
        </div>
      }
      editor={
        <CodeMirrorEditor
          filename={filename}
          value={draft}
          readOnly={!canEdit || saveState === 'saving'}
          onChange={handleDraftChange}
          onSave={saveDraft}
        />
      }
    />
  );
}
