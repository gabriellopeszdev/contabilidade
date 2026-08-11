'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, ExternalLink, LogOut } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useDialogA11y } from '../../hooks/useDialogA11y';

// =============================================================================
// ConsentModal — Bloqueia o uso até o usuário aceitar o termo LGPD vigente
// =============================================================================

export function ConsentModal() {
  const { token, usuario, carregando, logout } = useAuth();

  const [necessario, setNecessario] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  const dialogAberto = !verificando && necessario && !!usuario;
  const dialogRef = useDialogA11y(dialogAberto, undefined, true);

  // Verifica se o consentimento é necessário
  const verificar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/auth/consent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNecessario(data.necessario);
    } catch {
      // Silencioso — se falhar verifica na próxima navegação
    } finally {
      setVerificando(false);
    }
  }, [token]);

  useEffect(() => {
    if (!carregando && token) verificar();
    else if (!carregando) setVerificando(false);
  }, [carregando, token, verificar]);

  // Aceitar consentimento
  const aceitar = async () => {
    if (!token) return;
    setAceitando(true);
    setErro(null);

    try {
      const res = await fetch('/api/v1/auth/consent', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setSessaoExpirada(true);
          setErro('Sessão expirada. Faça login novamente.');
          return;
        }
        setErro(data.message ?? 'Erro ao registrar consentimento.');
        return;
      }

      setNecessario(false);
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setAceitando(false);
    }
  };

  // Não mostra nada enquanto verifica ou se não é necessário
  if (verificando || !necessario || !usuario) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-lgpd-titulo"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-300 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <ShieldCheck size={20} className="text-violet-600" />
          </div>
          <div>
            <h2 id="modal-lgpd-titulo" className="text-lg font-bold text-gray-900">
              Política de Privacidade e Termos
            </h2>
            <p className="text-xs text-gray-500">
              Conformidade com a Lei Geral de Proteção de Dados (LGPD)
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-3 max-h-64 overflow-y-auto border border-gray-100">
          <p>
            Prezado(a) <strong>{usuario.nome}</strong>, para continuar utilizando
            o sistema você precisa concordar com nossos termos atualizados:
          </p>

          <ul className="list-disc list-inside space-y-1.5 text-gray-600">
            <li>
              Seus dados pessoais (nome, e-mail, CNPJ/CRC) são tratados exclusivamente
              para fins de gestão contábil conforme a{' '}
              <strong>Lei nº 13.709/2018 (LGPD)</strong>.
            </li>
            <li>
              Documentos fiscais são armazenados com criptografia em trânsito e em
              repouso, acessíveis apenas por você e seu contador vinculado.
            </li>
            <li>
              Você pode solicitar a <strong>exclusão da sua conta</strong> e
              anonimização de dados pessoais a qualquer momento nas configurações.
            </li>
            <li>
              Logs de auditoria registram acessos aos seus documentos para sua
              segurança e transparência.
            </li>
            <li>
              Não compartilhamos dados com terceiros, exceto quando exigido por
              obrigação legal ou regulatória.
            </li>
          </ul>

          <div className="flex gap-3 pt-1">
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
            >
              <ExternalLink size={12} />
              Política de Privacidade
            </a>
            <a
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
            >
              <ExternalLink size={12} />
              Termos de Uso
            </a>
          </div>
        </div>

        {/* Error */}
        {erro && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            {erro}
          </p>
        )}

        {/* Actions */}
        {sessaoExpirada ? (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3
                       text-sm font-semibold text-white shadow-sm hover:bg-red-700
                       transition-colors focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <LogOut size={16} />
            Fazer login novamente
          </button>
        ) : (
          <button
            onClick={aceitar}
            disabled={aceitando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3
                       text-sm font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                       disabled:cursor-not-allowed transition-all focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {aceitando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Registrando…
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Li e concordo com os termos
              </>
            )}
          </button>
        )}

        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          Ao clicar no botão acima, você declara ter lido e concordar com a Política
          de Privacidade e os Termos de Uso do sistema. Seu consentimento será registrado
          com data, hora e endereço IP.
        </p>
      </div>
    </div>
  );
}
