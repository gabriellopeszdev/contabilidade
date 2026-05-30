'use client';

import { useEffect, useState } from 'react';
import type { PlanInfo } from '@/utils/planLimits';

export interface PlanoAtualState {
  plan: PlanInfo | null;
  loaded: boolean;
}

export function usePlanoAtual(token: string | null | undefined): PlanoAtualState {
  const [state, setState] = useState<PlanoAtualState>({ plan: null, loaded: false });

  useEffect(() => {
    if (!token) {
      setState({ plan: null, loaded: true });
      return;
    }

    let cancelled = false;
    setState({ plan: null, loaded: false });

    (async () => {
      try {
        const res = await fetch('/api/v1/plano/atual', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setState({ plan: data.plan ?? null, loaded: true });
        } else {
          if (!cancelled) setState({ plan: null, loaded: true });
        }
      } catch {
        if (!cancelled) setState({ plan: null, loaded: true });
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return state;
}
