'use client';

import { useAuthContext, type RoleUsuario, type UsuarioLogado } from '../context/AuthContext';

// =============================================================================
// useAuth — Interface pública do sistema de autenticação
//
// Este hook é o ponto de entrada único para todos os componentes e hooks
// que precisam de dados de autenticação. Ele encapsula o AuthContext e expõe
// uma API ergonômica, sem expor os detalhes de implementação do contexto.
//
// SEPARAÇÃO DE RESPONSABILIDADES:
//   AuthContext.tsx → gerencia o estado (login, logout, localStorage)
//   useAuth.ts      → interface pública estável para os consumidores
//
// Isso permite:
//   • Refatorar a implementação do contexto sem quebrar os consumidores
//   • Adicionar derivações (ex: isContador) sem poluir o contexto
//   • Mockar facilmente em testes (só precisa mockar este hook)
//
// COMPATIBILIDADE COM lote/page.tsx:
//   O stub inline de useAuth() em lote/page.tsx retorna { clienteId, getToken }.
//   Este hook retorna o mesmo contrato + campos adicionais, portanto é um
//   drop-in replacement. Basta substituir o stub pela importação:
//
//   - import { useAuth } from '../../../src/presentation/hooks/useAuth';
// =============================================================================

export type { RoleUsuario, UsuarioLogado };

export interface UseAuthReturn {
  /** Objeto do usuário logado ou null se não autenticado. */
  usuario: UsuarioLogado | null;

  /** JWT bruto (para uso direto em Authorization headers). */
  token: string | null;

  /** true enquanto o estado inicial está sendo lido do localStorage. */
  carregando: boolean;

  /** Atalho para usuario.role — null se não autenticado. */
  role: RoleUsuario | null;

  /**
   * ID do usuário logado (atalho para usuario.id).
   * null se não autenticado.
   */
  usuarioId: string | null;

  /**
   * ID do cliente selecionado pelo Contador para operar em seu nome.
   * Compatível com o `clienteId` do stub em lote/page.tsx.
   * null se nenhum cliente estiver selecionado.
   */
  clienteId: string | null;

  /**
   * Seleciona um cliente para operações em nome dele (role Contador).
   * Persiste no localStorage entre reloads.
   */
  selecionarCliente: (id: string | null) => void;

  /**
   * Retorna o JWT atual como Promise<string>.
   * Assíncrono para compatibilidade com futuros mecanismos de refresh silencioso.
   *
   * Uso:
   *   const token = await getToken();
   *   // headers: { Authorization: `Bearer ${token}` }
   */
  getToken: () => Promise<string>;

  /**
   * Autentica o usuário via POST /api/v1/auth/login.
   * Em caso de sucesso, o estado global e o localStorage são atualizados.
   * Lança Error com mensagem legível em caso de falha.
   */
  login: (email: string, senha: string) => Promise<void>;

  /** Encerra a sessão local. Limpa JWT e cliente selecionado do localStorage. */
  logout: () => void;

  /** true se o usuário logado tem role 'Contador'. */
  isContador: boolean;

  /** true se o usuário logado tem role 'Cliente'. */
  isCliente: boolean;

  /** true se o usuário logado tem role 'Admin' (Super Admin do SaaS). */
  isAdmin: boolean;

  /** true se o usuário logado tem role 'Funcionario'. */
  isFuncionario: boolean;

  /** true se Funcionário com vínculo ESCRITORIO. */
  isFuncionarioEscritorio: boolean;

  /** true se Funcionário com vínculo CLIENTE. */
  isFuncionarioCliente: boolean;

  /** true se é o dono (Contador/Cliente/Admin), não funcionário. */
  isDono: boolean;
}

export function useAuth(): UseAuthReturn {
  const {
    usuario,
    token,
    carregando,
    clienteSelecionado,
    selecionarCliente,
    getToken,
    login,
    logout,
  } = useAuthContext();

  return {
    usuario,
    token,
    carregando,
    role:              usuario?.role   ?? null,
    usuarioId:         usuario?.id     ?? null,
    clienteId:         clienteSelecionado,
    selecionarCliente,
    getToken,
    login,
    logout,
    isContador:        usuario?.role === 'Contador',
    isCliente:         usuario?.role === 'Cliente',
    isAdmin:           usuario?.role === 'Admin',
    isFuncionario:     usuario?.role === 'Funcionario',
    isFuncionarioEscritorio: usuario?.role === 'Funcionario' && usuario?.vinculo === 'ESCRITORIO',
    isFuncionarioCliente:    usuario?.role === 'Funcionario' && usuario?.vinculo === 'CLIENTE',
    isDono:            usuario?.role !== 'Funcionario' && usuario !== null,
  };
}
