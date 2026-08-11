'use client';

import { useEffect } from 'react';

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone)').matches;
  const ios = 'standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || Boolean(ios);
}

/**
 * No PWA, target=_blank em link do próprio FiscoHub abre o Chrome em vez do app.
 * Intercepta esses cliques e navega na janela do PWA.
 */
export function PwaSameOriginLinks() {
  useEffect(() => {
    if (!isStandalonePwa()) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.hasAttribute('download')) return;
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) return;

      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      window.location.assign(url.href);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
