'use client';

import { useEffect } from 'react';

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone)').matches;
  const ios = 'standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || Boolean(ios);
}

function isSefazHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (h.includes('sefaz') && h.endsWith('.gov.br'))
    || h === 'fazenda.gov.br'
    || h.endsWith('.fazenda.gov.br');
}

/**
 * No PWA, target=_blank em link do FiscoHub abre o Chrome.
 * Só intercepta _blank (mesmo origin) e portais da SEFAZ.
 * Links internos do Next.js continuam client-side.
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

      if (url.origin !== window.location.origin) {
        if (!isSefazHost(url.hostname)) return;
        e.preventDefault();
        window.location.assign(`/abrir?u=${encodeURIComponent(url.href)}`);
        return;
      }

      const blank = a.target === '_blank' || a.target === '_new';
      if (!blank) return;

      e.preventDefault();
      window.location.assign(url.href);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
