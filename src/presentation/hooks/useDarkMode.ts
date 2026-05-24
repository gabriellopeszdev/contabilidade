'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'tema-escuro';

export function useDarkMode() {
  // Sempre começa false no servidor (evita mismatch de hidratação)
  const [dark, setDark]       = useState(false);
  const [mounted, setMounted] = useState(false);

  // Lê preferência após montar no cliente
  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    const initial =
      salvo !== null
        ? salvo === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(initial);
    setMounted(true);
  }, []);

  // Aplica/remove classe e persiste — só após montar para não sobrescrever localStorage
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, String(dark));
  }, [dark, mounted]);

  const toggle = useCallback(() => setDark((v) => !v), []);

  return { dark, toggle, mounted };
}
