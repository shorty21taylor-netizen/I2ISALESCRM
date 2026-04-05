'use client';
import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';

export default function ThemeInit() {
  useEffect(function() {
    applyTheme();
  }, []);
  return null;
}
