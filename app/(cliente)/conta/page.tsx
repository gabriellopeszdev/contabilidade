'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface Preferencias {
  notifEmailNovoDoc: boolean;
  notifEmailBoleto:  boolean;
}

interface ToggleRowProps {
  label:     string;
  descricao: string;
  valor:     boolean;
  salvando:  boolean;
  onChange:  (v: boolean) => void;
}

function ToggleRow({ label, descricao, valor, salvando, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        aria-label={label}
        disabled={salvando}
        onClick={() => onChange(!valor)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          disabled:opacity-50
          ${valor ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${valor ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

export default function ClienteConfiguracoesPage() {
  const { token } = useAuth();

  const [prefs, setPrefs]           = useState<Preferencias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando]     = useState(false);
  const [toast, setToast]           = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/auth/preferencias-notificacao', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPrefs({
        notifEmailNovoDoc: d.notifEmailNovoDoc ?? true,
        notifEmailBoleto:  d.notifEmailBoleto  ?? true,
      }))
      .catch(() => setPrefs({ notifEmailNovoDoc: true, notifEmailBoleto: true }))
      .finally(() => setCarregando(false));
  }, [token]);

  const mostrarToast = (tipo: 'sucesso' | 'erro', msg: string) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const salvar = async (campo: keyof Preferencias, valor: boolean) => {
    if (!token || salvando || !prefs) return;
    const anterior = prefs[campo];
    setSalvando(true);
    setPrefs({ ...prefs, [campo]: valor });
    try {
      const res = await fetch('/api/v1/auth/preferencias-notificacao', {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) throw new Error();
      mostrarToast('sucesso', 'Preferência salva.');
    } catch {
      setPrefs({ ...prefs, [campo]: anterior });
      mostrarToast('erro', 'Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gerencie suas preferências de notificação.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : prefs ? (
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Notificações por e-mail
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            <ToggleRow
              label="Novo documento disponível"
              descricao="Receber e-mail quando seu contador enviar um documento."
              valor={prefs.notifEmailNovoDoc}
              salvando={salvando}
              onChange={(v) => salvar('notifEmailNovoDoc', v)}
            />
            <ToggleRow
              label="Lembrete de boleto"
              descricao="Receber e-mail quando um boleto estiver próximo do vencimento."
              valor={prefs.notifEmailBoleto}
              salvando={salvando}
              onChange={(v) => salvar('notifEmailBoleto', v)}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-500">Não foi possível carregar as preferências.</p>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
          ${toast.tipo === 'sucesso'
            ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
          }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
