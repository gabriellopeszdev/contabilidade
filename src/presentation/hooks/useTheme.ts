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
// Retorna { logoUrl, nomeEscritorio, loaded } para uso nas sidebars.
// Cache em localStorage para evitar flash ao navegar entre páginas.
// =============================================================================

const CACHE_KEY = 'fisco-theme-brand';

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
  /** true after the config fetch completes (success or failure). */
  loaded: boolean;
}

function readCache(): { logoUrl: string | null; nomeEscritorio: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { logoUrl: string | null; nomeEscritorio: string };
  } catch {
    return null;
  }
}

function writeCache(logoUrl: string | null, nomeEscritorio: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ logoUrl, nomeEscritorio }));
  } catch {
    // storage full or blocked — silently ignore
  }
}

function hexToRgbString(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

export function applyThemeCssVars(corPrimaria: string, corSecundaria?: string): void {
  const root = document.documentElement.style;
  root.setProperty('--color-primary',       corPrimaria);
  root.setProperty('--color-brand',         corPrimaria);
  root.setProperty('--color-primary-light', tint(corPrimaria, 0.85));
  root.setProperty('--color-primary-50',    tint(corPrimaria, 0.93));

  // RGB versions for Tailwind opacity support
  root.setProperty('--color-primary-rgb',       hexToRgbString(corPrimaria));
  root.setProperty('--color-primary-light-rgb', hexToRgbString(tint(corPrimaria, 0.85)));
  root.setProperty('--color-primary-50-rgb',    hexToRgbString(tint(corPrimaria, 0.93)));

  if (corSecundaria) {
    root.setProperty('--color-primary-dark', corSecundaria);
    root.setProperty('--color-brand-dark',   corSecundaria);
    root.setProperty('--color-primary-dark-rgb', hexToRgbString(corSecundaria));
  } else {
    root.setProperty('--color-primary-dark-rgb', hexToRgbString('#1e3a8a'));
  }
}

export function useTheme(token: string | null | undefined): ThemeBrand {
  const [brand, setBrand] = useState<ThemeBrand>({ logoUrl: null, nomeEscritorio: '', loaded: false });

  // Restore from cache immediately on mount to prevent flash during navigation
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setBrand({ ...cached, loaded: true });
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setBrand((prev) => ({ ...prev, loaded: true }));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/v1/escritorio/config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          if (!cancelled) setBrand((prev) => ({ ...prev, loaded: true }));
          return;
        }
        const data = await res.json();
        const { corPrimaria, corSecundaria, logoUrl, nomeEscritorio } = data.config ?? {};

        if (corPrimaria) {
          applyThemeCssVars(corPrimaria, corSecundaria);
        }

        if (!cancelled) {
          const newLogoUrl = logoUrl ?? null;
          const newNome = nomeEscritorio ?? '';
          setBrand({ logoUrl: newLogoUrl, nomeEscritorio: newNome, loaded: true });
          writeCache(newLogoUrl, newNome);
        }
      } catch {
        if (!cancelled) setBrand((prev) => ({ ...prev, loaded: true }));
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return brand;
}
