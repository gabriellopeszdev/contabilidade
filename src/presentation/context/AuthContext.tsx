'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { decodeJwt } from 'jose';

// =============================================================================
// Tipos
// =============================================================================

/** Role do usuário mapeado do backend (ACCOUNTANT/CLIENT/ADMIN/EMPLOYEE) para o frontend. */
export type RoleUsuario = 'Contador' | 'Cliente' | 'Admin' | 'Funcionario';

export interface UsuarioLogado {
  id:    string;
  email: string;
  nome:  string;
  role:  RoleUsuario;
  /** Setores autorizados (apenas para role = Funcionario). */
  setores?:    string[];
  /** Tipo de vínculo: ESCRITORIO ou CLIENTE (apenas para Funcionario). */
  vinculo?:    string;
  /** ID do superior hierárquico (apenas para Funcionario). */
  superiorId?: string;
}

interface AuthContextValue {
  /** Usuário autenticado ou null se não logado. */
  usuario:            UsuarioLogado | null;
  /** JWT bruto armazenado no localStorage. */
  token:              string | null;
  /** true enquanto o estado inicial está sendo lido do localStorage. */
  carregando:         boolean;
  /**
   * ID do cliente atualmente selecionado pelo Contador.
   * Persiste entre reloads via localStorage.
   * null quando nenhum cliente está selecionado.
   */
  clienteSelecionado: string | null;
  /** Seleciona um cliente para operar em nome dele (role Contador). */
  selecionarCliente:  (clienteId: string | null) => void;
  /**
   * Retorna o JWT atual para uso em chamadas HTTP e no handshake WebSocket.
   * Assíncrono para compatibilidade futura com refresh automático de token.
   */
  getToken:           () => Promise<string>;
  /**
   * Autentica o usuário via POST /api/v1/auth/login.
   * Armazena o JWT no localStorage e atualiza o estado global.
   * Lança `Requer2FAError` se o backend exigir 2FA, ou Error em caso de falha.
   */
  login:              (email: string, senha: string) => Promise<void>;
  /**
   * Finaliza o login após verificação 2FA bem-sucedida.
   * Recebe o JWT retornado pelo endpoint de verificação e o armazena.
   * Lança Error se o token for inválido.
   */
  finalizarLogin:     (jwt: string) => void;
  /** Limpa o JWT e o estado global, efetivamente deslogando o usuário. */
  logout:             () => void;
}

// =============================================================================
// Erro tipado para fluxo 2FA
// =============================================================================

/**
 * Lançado por `login` quando o backend exige verificação de segundo fator.
 * O caller deve capturar este erro, exibir o formulário TOTP/backup e, após
 * verificação bem-sucedida, chamar `finalizarLogin(jwt)` com o token final.
 */
export class Requer2FAError extends Error {
  constructor(public readonly tempToken: string) {
    super('2FA_REQUIRED');
    this.name = 'Requer2FAError';
  }
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Chaves do localStorage
// =============================================================================

const TOKEN_KEY    = 'contabilidade_jwt';
const TOKEN_COOKIE = 'contabilidade_jwt';
const CLIENT_KEY   = 'contabilidade_cliente_selecionado';

/**
 * Sincroniza o JWT com um cookie acessível pelo middleware Edge.
 * O cookie é SameSite=Lax (navegação normal) e NÃO httpOnly (precisa
 * ser legível pelo JS para excluí-lo no logout).
 * Em produção, configure Secure=true via HTTPS.
 */
function sincronizarCookie(jwt: string | null): void {
  if (jwt) {
    try {
      const { exp } = decodeJwt(jwt);
      if (exp) {
        const maxAge = Math.max(0, Math.floor(exp - Date.now() / 1000));
        document.cookie = `${TOKEN_COOKIE}=${jwt}; path=/; max-age=${maxAge}; SameSite=Lax`;
        return;
      }
    } catch {}
    // Fallback para 8 horas (28800 segundos)
    document.cookie = `${TOKEN_COOKIE}=${jwt}; path=/; max-age=28800; SameSite=Lax`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Mapeamento de role do backend para o frontend.
 * ADMIN recebe os mesmos privilégios de Contador na UI.
 */
const ROLE_MAP: Record<string, RoleUsuario> = {
  ACCOUNTANT: 'Contador',
  CLIENT:     'Cliente',
  ADMIN:      'Admin',
  EMPLOYEE:   'Funcionario',
};

/**
 * Decodifica o payload do JWT SEM verificar a assinatura.
 * A verificação de assinatura é responsabilidade do servidor.
 * O cliente só precisa dos dados do payload para renderizar a UI.
 */
function decodificarToken(token: string): UsuarioLogado | null {
  try {
    const payload = decodeJwt(token);
    if (!payload.sub) return null;

    return {
      id:    payload.sub,
      email: (payload.email as string) ?? '',
      nome:  (payload.nome  as string) ?? (payload.email as string) ?? 'Usuário',
      role:  ROLE_MAP[(payload.role as string) ?? ''] ?? 'Cliente',
      setores:    (payload.setores    as string[]) ?? undefined,
      vinculo:    (payload.vinculo    as string)   ?? undefined,
      superiorId: (payload.superiorId as string)   ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna true se o token está expirado (com 30 segundos de margem antecipada
 * para evitar requisições com token prestes a expirar).
 */
function tokenExpirado(token: string): boolean {
  try {
    const { exp } = decodeJwt(token);
    if (!exp) return false;
    return Date.now() / 1_000 > exp - 30;
  } catch {
    return true;
  }
}

// =============================================================================
// AuthProvider
// =============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,              setToken]              = useState<string | null>(null);
  const [usuario,            setUsuario]            = useState<UsuarioLogado | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [carregando,         setCarregando]         = useState(true);

  // ---------------------------------------------------------------------------
  // Inicialização — lê o estado persistido do localStorage
  //
  // Executado uma única vez, no primeiro render client-side.
  // Não executa no SSR (localStorage é undefined no servidor).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const storedToken  = localStorage.getItem(TOKEN_KEY);
    const storedClient = localStorage.getItem(CLIENT_KEY);

    if (storedToken && !tokenExpirado(storedToken)) {
      const decoded = decodificarToken(storedToken);
      if (decoded) {
        setToken(storedToken);
        setUsuario(decoded);
        sincronizarCookie(storedToken);
      } else {
        // Token presente mas indecodificável — descarta
        localStorage.removeItem(TOKEN_KEY);
        sincronizarCookie(null);
      }
    } else if (storedToken) {
      // Token expirado — limpa proativamente
      localStorage.removeItem(TOKEN_KEY);
      sincronizarCookie(null);
    }

    if (storedClient) {
      setClienteSelecionado(storedClient);
    }

    setCarregando(false);
  }, []);

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------
  const login = useCallback(async (email: string, senha: string): Promise<void> => {
    const res = await fetch('/api/v1/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, senha }),
    });

    if (!res.ok) {
      let mensagem = 'Falha na autenticação';
      try {
        const data = (await res.json()) as { message?: string };
        if (data.message) mensagem = data.message;
      } catch { /* JSON inválido — usa mensagem padrão */ }
      throw new Error(mensagem);
    }

    const data = (await res.json()) as { token?: string; requires2FA?: boolean; tempToken?: string };

    // Segundo fator exigido — lança erro tipado para o caller exibir o step TOTP
    if (data.requires2FA) {
      throw new Requer2FAError(data.tempToken ?? '');
    }

    const jwt = data.token ?? '';
    const decoded = decodificarToken(jwt);

    if (!decoded) {
      throw new Error('O servidor retornou um token inválido.');
    }

    localStorage.setItem(TOKEN_KEY, jwt);
    sincronizarCookie(jwt);
    setToken(jwt);
    setUsuario(decoded);
  }, []);

  // ---------------------------------------------------------------------------
  // finalizarLogin — usado após verificação 2FA bem-sucedida
  // ---------------------------------------------------------------------------
  const finalizarLogin = useCallback((jwt: string): void => {
    const decoded = decodificarToken(jwt);
    if (!decoded) {
      throw new Error('O servidor retornou um token inválido após verificação 2FA.');
    }
    localStorage.setItem(TOKEN_KEY, jwt);
    sincronizarCookie(jwt);
    setToken(jwt);
    setUsuario(decoded);
  }, []);

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENT_KEY);
    sincronizarCookie(null);
    setToken(null);
    setUsuario(null);
    setClienteSelecionado(null);
  }, []);

  // ---------------------------------------------------------------------------
  // getToken
  //
  // Lê diretamente do localStorage para sempre retornar o token mais recente,
  // inclusive após um refresh silencioso futuro que atualize o storage.
  // ---------------------------------------------------------------------------
  const getToken = useCallback((): Promise<string> => {
    const current = localStorage.getItem(TOKEN_KEY) ?? '';
    return Promise.resolve(current);
  }, []);

  // ---------------------------------------------------------------------------
  // selecionarCliente
  // ---------------------------------------------------------------------------
  const selecionarCliente = useCallback((clienteId: string | null) => {
    if (clienteId) {
      localStorage.setItem(CLIENT_KEY, clienteId);
    } else {
      localStorage.removeItem(CLIENT_KEY);
    }
    setClienteSelecionado(clienteId);
  }, []);

  // ---------------------------------------------------------------------------
  // Valor do contexto — memorizado para evitar re-renders desnecessários
  // ---------------------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      token,
      carregando,
      clienteSelecionado,
      selecionarCliente,
      getToken,
      login,
      finalizarLogin,
      logout,
    }),
    [usuario, token, carregando, clienteSelecionado, selecionarCliente, getToken, login, finalizarLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Hook interno — consumido apenas pelo useAuth.ts
//
// Separar AuthProvider e useAuthContext em arquivos diferentes é intencional:
//   - AuthContext.tsx  → gerencia o estado (pode ser complexo)
//   - useAuth.ts       → expõe a API pública (interface estável para os componentes)
// =============================================================================

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      '[useAuthContext] Deve ser chamado dentro de <AuthProvider>. ' +
      'Verifique se app/layout.tsx envolve a árvore com <AuthProvider>.',
    );
  }
  return ctx;
}
