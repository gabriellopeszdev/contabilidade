'use client';

import { useEffect, useState } from 'react';

// =============================================================================
// useTheme — Carrega as cores White Label do escritório e aplica como CSS vars
//
// Faz fetch em /api/v1/escritorio/config e define:
//   --color-primary      → corPrimaria
//   --color-primary-dark → corSecundaria
//   --color-primary-light / --color-primary-50 → derivadas automaticamente
//
// Retorna { logoUrl, nomeEscritorio } para uso nas sidebars.
// =============================================================================

/** Converte hex (#RRGGBB) em { r, g, b }. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** Mistura a cor com branco na proporção dada (0-1). Retorna hex. */
function tint(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const r = Math.round(c.r + (255 - c.r) * amount);
  const g = Math.round(c.g + (255 - c.g) * amount);
  const b = Math.round(c.b + (255 - c.b) * amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export interface ThemeBrand {
  logoUrl: string | null;
  nomeEscritorio: string;
}

export function useTheme(token: string | null | undefined): ThemeBrand {
  const [brand, setBrand] = useState<ThemeBrand>({ logoUrl: null, nomeEscritorio: '' });

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/v1/escritorio/config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const { corPrimaria, corSecundaria, logoUrl, nomeEscritorio } = data.config ?? {};

        const root = document.documentElement.style;

        if (corPrimaria) {
          root.setProperty('--color-primary', corPrimaria);
          root.setProperty('--color-brand', corPrimaria);
          root.setProperty('--color-primary-light', tint(corPrimaria, 0.85));
          root.setProperty('--color-primary-50', tint(corPrimaria, 0.93));
        }
        if (corSecundaria) {
          root.setProperty('--color-primary-dark', corSecundaria);
          root.setProperty('--color-brand-dark', corSecundaria);
        }

        if (!cancelled) {
          setBrand({
            logoUrl: logoUrl ?? null,
            nomeEscritorio: nomeEscritorio ?? '',
          });
        }
      } catch {
        // Silently ignore — fallback CSS vars remain
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return brand;
}
