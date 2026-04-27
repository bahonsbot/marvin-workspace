'use client';

import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, RefObject } from 'react';
import { monoFont } from '@/components/chat/chat-rich-text';
import type { SpeechToTextStatus } from '@/components/chat/useSpeechToText';
import { composerIconButtonStyle } from '@/components/chat/chat-ui-helpers';

type AttachedFile = { name: string; path: string; size: number; mimeType: string };

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 3 10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3 14 21l-4-7-7-4 18-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewSessionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3c5 0 9 3.58 9 8s-4 8-9 8a10.6 10.6 0 0 1-4-.77L3 21l1.55-4.12A7.4 7.4 0 0 1 3 11c0-4.42 4.03-8 9-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 5.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 7.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.44 11.05 12 20.5a6 6 0 1 1-8.49-8.49l10.6-10.61a4 4 0 1 1 5.66 5.66L8.46 18.36a2 2 0 1 1-2.83-2.82l9.2-9.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatComposer({
  fileInputRef,
  onSubmit,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  attachedFiles,
  setAttachedFiles,
  isDraggingFiles,
  composerValue,
  setComposerValue,
  onComposerKeyDown,
  composerDisabled,
  composerPlaceholder,
  uploadBusy,
  speechButtonEnabled,
  speechSupported,
  speechStatus,
  onToggleRecording,
  onNewSession,
  canCreateNewSession,
  canSubmit,
  sendButtonLabel,
  sendButtonTitle,
  speechSupportReason,
  speechError,
  speechMessage,
  composerError,
  liveSendError,
  effectiveBridgeError,
  liveTargetSession,
  sessionState,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDragOver: (event: DragEvent<HTMLFormElement>) => void;
  onDragLeave: (event: DragEvent<HTMLFormElement>) => void;
  onDrop: (event: DragEvent<HTMLFormElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  attachedFiles: AttachedFile[];
  setAttachedFiles: (updater: (current: AttachedFile[]) => AttachedFile[]) => void;
  isDraggingFiles: boolean;
  composerValue: string;
  setComposerValue: (value: string) => void;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  composerDisabled: boolean;
  composerPlaceholder: string;
  uploadBusy: boolean;
  speechButtonEnabled: boolean;
  speechSupported: boolean;
  speechStatus: SpeechToTextStatus;
  onToggleRecording: () => void;
  onNewSession: () => void;
  canCreateNewSession: boolean;
  canSubmit: boolean;
  sendButtonLabel: string;
  sendButtonTitle: string;
  speechSupportReason: string | null;
  speechError: string | null;
  speechMessage: string | null;
  composerError: string | null;
  liveSendError: string | null;
  effectiveBridgeError: string | null;
  liveTargetSession: string | null;
  sessionState: string;
}) {
  const friendlyComposerError = (composerError || liveSendError || effectiveBridgeError || (!liveTargetSession && sessionState === 'connected'))
    ? composerError || liveSendError || (effectiveBridgeError ? `Last refresh error: ${effectiveBridgeError}` : 'The chat connection is live, but Mission Control still needs an active chat before it can send.')
    : null;

  return (
    <form className="mc-chat-composer" onSubmit={onSubmit} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{ border: isDraggingFiles ? '1px solid rgba(121, 166, 148, 0.54)' : '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: isDraggingFiles ? 'rgba(244, 249, 246, 0.96)' : 'rgba(255, 255, 255, 0.9)', padding: 12, display: 'grid', gap: 8, zIndex: 11, boxShadow: '0 -8px 24px rgba(26, 61, 50, 0.08)', minWidth: 0 }}>
      <input ref={fileInputRef} type="file" multiple onChange={onFileInputChange} style={{ display: 'none' }} />
      {attachedFiles.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {attachedFiles.map((file) => (
            <div key={`${file.path}-${file.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(200, 195, 188, 0.28)', background: 'rgba(250, 248, 245, 0.92)', fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ fontFamily: monoFont }}>{file.name}</span>
              <button type="button" onClick={() => setAttachedFiles((current) => current.filter((entry) => entry.path !== file.path))} style={{ border: 'none', background: 'transparent', color: 'var(--text-ghost)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      ) : null}
      {isDraggingFiles ? <div style={{ fontSize: 12, color: '#163b31', padding: '2px 2px 0' }}>Drop files here to upload them into <span style={{ fontFamily: monoFont }}>uploads/mission-control/</span>.</div> : null}
      <div className="mc-chat-composer-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end', minWidth: 0 }}>
        <textarea
          value={composerValue}
          onChange={(event) => setComposerValue(event.target.value)}
          onKeyDown={onComposerKeyDown}
          rows={2}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          aria-label="Composer"
          style={{
            width: '100%',
            minHeight: 64,
            maxHeight: 120,
            resize: 'none',
            borderRadius: 16,
            border: '1px solid rgba(200, 195, 188, 0.32)',
            background: 'rgba(250, 248, 245, 0.94)',
            padding: '12px 14px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
        <div className="mc-chat-composer-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadBusy}
            aria-label="Add attachment"
            title={uploadBusy ? 'Uploading...' : 'Add attachment'}
            style={composerIconButtonStyle(!uploadBusy)}
          >
            <PaperclipIcon />
          </button>
          <button
            type="button"
            onClick={onToggleRecording}
            disabled={!speechButtonEnabled}
            aria-label={speechStatus === 'recording' ? 'Stop recording' : speechStatus === 'transcribing' ? 'Transcribing audio' : 'Start voice input'}
            title={!speechSupported ? 'Voice input is not supported in this browser' : speechStatus === 'recording' ? 'Stop recording' : speechStatus === 'transcribing' ? 'Transcribing...' : 'Start voice input'}
            style={{
              ...composerIconButtonStyle(speechButtonEnabled),
              background: speechStatus === 'recording' ? 'rgba(183, 76, 67, 0.18)' : speechStatus === 'transcribing' ? 'rgba(121, 166, 148, 0.2)' : composerIconButtonStyle(speechButtonEnabled).background,
              border: speechStatus === 'recording' ? '1px solid rgba(183, 76, 67, 0.46)' : speechStatus === 'transcribing' ? '1px solid rgba(121, 166, 148, 0.42)' : composerIconButtonStyle(speechButtonEnabled).border,
              color: speechStatus === 'recording' ? '#8e2f26' : undefined,
            }}
          >
            <MicIcon />
          </button>
          <button
            type="button"
            onClick={onNewSession}
            disabled={!canCreateNewSession}
            aria-label="New session"
            title="New session"
            style={composerIconButtonStyle(canCreateNewSession)}
          >
            <NewSessionIcon />
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={sendButtonLabel}
            title={sendButtonTitle}
            style={composerIconButtonStyle(canSubmit)}
          >
            <SendIcon />
          </button>
        </div>
      </div>
      {(!speechSupported || speechStatus === 'recording' || speechStatus === 'transcribing' || speechError || speechMessage) ? (
        <div
          style={{
            fontSize: 12,
            color: speechError ? '#9a4b43' : speechStatus === 'recording' ? '#8e2f26' : 'var(--text-muted)',
            maxWidth: 720,
          }}
        >
          {!speechSupported
            ? (speechSupportReason || 'Voice input is not available in this browser.')
            : speechError
              ? `Voice input error: ${speechError}`
              : speechStatus === 'recording'
                ? 'Recording… click the mic again to stop.'
                : speechStatus === 'transcribing'
                  ? 'Transcribing…'
                  : speechMessage}
        </div>
      ) : null}
      {friendlyComposerError ? (
        <div style={{ fontSize: 12, color: composerError || liveSendError || effectiveBridgeError ? '#9a4b43' : 'var(--text-muted)', maxWidth: 720 }}>
          {friendlyComposerError}
        </div>
      ) : null}
    </form>
  );
}
