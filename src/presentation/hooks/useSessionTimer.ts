'use client';

import { useState, useEffect } from 'react';
import { decodeJwt } from 'jose';

const TOKEN_KEY = 'contabilidade_jwt';

function lerExpiracao(): number | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const { exp } = decodeJwt(token);
    return exp ?? null;
  } catch {
    return null;
  }
}

/**
 * Retorna o tempo restante da sessão JWT com atualização a cada segundo.
 * - `formatado`: "2h 34m" quando > 1h, "MM:SS" quando < 1h
 * - `critico`: true quando ≤ 5 minutos
 * - `urgente`: true quando ≤ 1 minuto
 */
export function useSessionTimer() {
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  useEffect(() => {
    function atualizar() {
      const exp = lerExpiracao();
      if (!exp) { setSegundosRestantes(null); return; }
      setSegundosRestantes(Math.max(0, Math.floor(exp - Date.now() / 1_000)));
    }

    atualizar();
    const id = setInterval(atualizar, 1_000);
    return () => clearInterval(id);
  }, []);

  const formatado = (() => {
    if (segundosRestantes === null) return null;
    const h = Math.floor(segundosRestantes / 3_600);
    const m = Math.floor((segundosRestantes % 3_600) / 60);
    const s = segundosRestantes % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  const critico = segundosRestantes !== null && segundosRestantes <= 300;
  const urgente = segundosRestantes !== null && segundosRestantes <= 60;

  return { segundosRestantes, formatado, critico, urgente };
}
