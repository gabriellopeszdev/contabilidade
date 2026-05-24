'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'tema-escuro';

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo !== null) return salvo === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, String(dark));
  }, [dark]);

  const toggle = useCallback(() => setDark((v) => !v), []);

  return { dark, toggle };
}
