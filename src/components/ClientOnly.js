'use client';
import { useState, useEffect } from 'react';
export default function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="flex items-center justify-center h-[280px] text-crm-muted text-xs font-mono">Loading...</div>;
  return children;
}
