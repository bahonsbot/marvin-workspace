import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

export const missionControlEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    color: 'var(--text-body)',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono), SFMono-Regular, ui-monospace, monospace',
    lineHeight: '1.7',
    overflow: 'auto',
  },
  '.cm-content': {
    minHeight: '520px',
    padding: '18px 20px 26px',
    caretColor: 'var(--accent-dark)',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-gutters': {
    color: 'var(--text-muted)',
    borderRight: '1px solid rgba(200, 195, 188, 0.35)',
    backgroundColor: 'rgba(248, 243, 237, 0.45)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(212, 231, 221, 0.5)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(212, 231, 221, 0.22)',
  },
  '.cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(121, 166, 148, 0.35) !important',
  },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'rgba(212, 231, 221, 0.65)',
    outline: '1px solid rgba(121, 166, 148, 0.5)',
  },
  '.cm-search': {
    border: '1px solid rgba(200, 195, 188, 0.9)',
    borderRadius: '12px',
    background: 'rgba(255, 253, 251, 0.98)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    padding: '8px',
    gap: '8px',
  },
  '.cm-search input': {
    border: '1px solid rgba(200, 195, 188, 0.8)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.9)',
    color: 'var(--text-body)',
    padding: '4px 8px',
    outline: 'none',
  },
  '.cm-search input:focus': {
    borderColor: 'rgba(121, 166, 148, 0.7)',
    boxShadow: '0 0 0 1px rgba(121, 166, 148, 0.3)',
  },
  '.cm-button': {
    border: '1px solid rgba(200, 195, 188, 0.9)',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.88)',
    color: 'var(--text-body)',
    padding: '4px 9px',
  },
  '.cm-button:hover': {
    borderColor: 'rgba(121, 166, 148, 0.7)',
    background: 'rgba(212, 231, 221, 0.5)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 216, 156, 0.58)',
    outline: '1px solid rgba(196, 130, 58, 0.45)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(196, 130, 58, 0.36)',
    outline: '1px solid rgba(168, 100, 36, 0.7)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
});

const highlighting = HighlightStyle.define([
  { tag: [tags.heading, tags.keyword], color: '#315f51', fontWeight: '700' },
  { tag: [tags.string, tags.special(tags.string)], color: '#8b5e3b' },
  { tag: [tags.number, tags.bool, tags.atom], color: '#7b4d9f' },
  { tag: [tags.comment, tags.quote], color: '#8a847a', fontStyle: 'italic' },
  { tag: [tags.variableName, tags.propertyName], color: '#2f3a33' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: '#245a6e' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: '#5c5a56' },
]);

export const missionControlEditorHighlighting = syntaxHighlighting(highlighting);
