'use client';
import { useEffect } from 'react';
export default function Error({ error, reset }) {
  useEffect(() => { console.error('[RUNTIME ERROR]', error); }, [error]);
  return (
    <div style={{ padding: '2rem', color: '#fafafa', background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '1rem' }}>Something went wrong</h1>
      <pre style={{ fontSize: '14px', color: '#ef4444', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
      <pre style={{ fontSize: '12px', color: '#6b6b6b', marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{error.stack}</pre>
      <button onClick={reset} style={{ marginTop: '1rem', padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Try again</button>
    </div>
  );
}
