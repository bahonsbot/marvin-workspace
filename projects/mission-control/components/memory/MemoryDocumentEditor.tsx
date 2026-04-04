'use client';

import { useEffect, useMemo, useState } from 'react';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
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
  const filename = useMemo(() => document.path.split('/').pop() || document.title || 'memory.md', [document.path, document.title]);

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
      }
      editor={
        <CodeMirrorEditor
          filename={filename}
          value={draft}
          readOnly={!canEdit || saveState === 'saving'}
          onChange={setDraft}
          onSave={saveDraft}
        />
      }
    />
  );
}
