'use client';
export default function GlobalError({ error, reset }) {
  return (
    <html><body style={{ padding: '2rem', color: '#fafafa', background: '#0a0a0a', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '1rem' }}>Global error</h1>
      <pre style={{ fontSize: '14px', color: '#ef4444', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
      <button onClick={reset} style={{ marginTop: '1rem', padding: '8px 16px', background: '#262626', color: '#fafafa', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Try again</button>
    </body></html>
  );
}
