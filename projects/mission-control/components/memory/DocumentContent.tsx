export function DocumentContent({ content, exists }: { content: string; exists: boolean }) {
  if (!exists) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 18,
          padding: 28,
          color: 'var(--text-muted)',
          background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.92) 0%, rgba(245, 239, 232, 0.82) 100%)',
          textAlign: 'center',
        }}
      >
        Source file not found yet. This view stays truthful and read-only.
      </div>
    );
  }

  return (
    <pre
      style={{
        margin: 0,
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '24px 26px',
        background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.96) 0%, rgba(247, 241, 235, 0.9) 100%)',
        color: 'var(--text-body)',
        fontSize: 14,
        lineHeight: 1.8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </pre>
  );
}
