'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/presentation/hooks/useAuth';

// =============================================================================
// ImpersonationBanner
//
// Banner fixo no topo da tela, exibido apenas durante sessões de impersonação
// (quando `usuario.impersonadoPor` está presente no JWT decodificado).
// O botão "Voltar" dispara o AuditLog de encerramento antes de restaurar
// o token do admin original.
// =============================================================================

export function ImpersonationBanner() {
  const { usuario, token, encerrarImpersonacao } = useAuth();
  const router = useRouter();

  if (!usuario?.impersonadoPor) return null;

  const handleVoltar = () => {
    // Fire-and-forget: grava o log de encerramento usando o token de impersonação atual
    if (token) {
      fetch('/api/v1/admin/impersonar/encerrar', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    encerrarImpersonacao();
    router.push('/dashboard-admin');
  };

  return (
    <div
      role="alert"
      style={{ zIndex: 9999 }}
      className="fixed top-0 left-0 right-0 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2.5 text-amber-950"
    >
      <p className="text-sm font-semibold">
        Você está acessando a conta de{' '}
        <strong>{usuario.nome}</strong> como suporte administrativo.
      </p>
      <button
        onClick={handleVoltar}
        className="shrink-0 rounded-lg bg-amber-950/20 px-3 py-1 text-xs font-bold hover:bg-amber-950/30 transition-colors"
      >
        Voltar para o painel admin
      </button>
    </div>
  );
}
