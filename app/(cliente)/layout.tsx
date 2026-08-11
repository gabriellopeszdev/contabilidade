'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CobrancaPendente } from '../../src/types/billing';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Upload,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Loader2,
  Bell,
  ChevronDown,
  Building2,
  MessageSquare,
  DollarSign,
  Home,
  Clock,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  Users,
  PenLine,
  Settings,
  LayoutDashboard,
  Megaphone,
} from 'lucide-react';

import { useAuth }          from '../../src/presentation/hooks/useAuth';
import { useNotificacoes, type StatusConexao } from '../../src/presentation/hooks/useNotificacoes';
import { useTheme }         from '../../src/presentation/hooks/useTheme';
import { useSessionTimer }  from '../../src/presentation/hooks/useSessionTimer';
import { useDarkMode }      from '../../src/presentation/hooks/useDarkMode';
import { InstitutionalFooter } from '../../src/presentation/components/lgpd/InstitutionalFooter';
import { ModalBloqueioInadimplencia } from '../../src/presentation/components/billing/ModalBloqueioInadimplencia';
import { ClientHelpTutorialModal } from './components/ClientHelpTutorialModal';
import { NpsModal } from './components/NpsModal';

// =============================================================================
// Navegação da Sidebar
// =============================================================================


interface NavItem {
  href:      string;
  label:     string;
  icon:      React.ReactNode;
  donoOnly?: boolean;
}

interface NavGroup {
  label?:    string;
  donoOnly?: boolean;
  items:     NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/inicio', label: 'Início',  icon: <Home            size={18} /> },
      { href: '/painel', label: 'Painel',  icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    label: 'Documentos',
    items: [
      { href: '/documentos',  label: 'Meus Documentos', icon: <FileText  size={18} /> },
      { href: '/enviar',      label: 'Histórico de Envios',  icon: <Clock    size={18} /> },
      { href: '/minhas-assinaturas', label: 'Assinaturas', icon: <PenLine size={18} /> },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/financeiro', label: 'Financeiro', icon: <DollarSign size={18} /> },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { href: '/chat', label: 'Chat', icon: <MessageSquare size={18} /> },
      { href: '/informativos', label: 'Informativos', icon: <Megaphone size={18} /> },
    ],
  },
  {
    label: 'Minha Empresa',
    donoOnly: true,
    items: [
      { href: '/minha-equipe', label: 'Minha Equipe', icon: <Users size={18} />, donoOnly: true },
    ],
  },
  {
    label: 'Conta',
    items: [
      { href: '/conta', label: 'Configurações', icon: <Settings size={18} /> },
    ],
  },
  {
    label: 'Suporte',
    items: [
      { href: '/ajuda', label: 'Ajuda', icon: <HelpCircle size={18} /> },
    ],
  },
];

// =============================================================================
// Badge de status do WebSocket
// =============================================================================

const STATUS_CONFIG: Record<StatusConexao, { label: string; cor: string }> = {
  desconectado: { label: 'Offline',          cor: 'bg-gray-400' },
  conectando:   { label: 'Conectando…',      cor: 'bg-yellow-400 animate-pulse' },
  conectado:    { label: 'Online',           cor: 'bg-emerald-500' },
  reconectando: { label: 'Reconectando…',    cor: 'bg-yellow-400 animate-pulse' },
  erro_auth:    { label: 'Sessão expirada',  cor: 'bg-red-500' },
};

// =============================================================================
// Layout do Portal do Cliente
// =============================================================================

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const { usuario, token, carregando, logout, getToken, isCliente, isFuncionarioCliente } = useAuth();

  const [bloqueioSaaS, setBloqueioSaaS] = useState<{
    bloqueado: boolean;
    cobranca: CobrancaPendente | null;
  } | null>(null);

  const checkFaturamentoStatus = useCallback(async () => {
    if (!token) return true;
    try {
      const res = await fetch('/api/v1/minha-assinatura/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return true;
      const data = await res.json();
      setBloqueioSaaS({
        bloqueado: Boolean(data.bloqueado),
        cobranca: data.cobranca ?? null,
      });
      return !data.bloqueado;
    } catch {
      return true;
    }
  }, [token]);

  useEffect(() => {
    if (!carregando && token) {
      checkFaturamentoStatus();
    }
  }, [carregando, token, checkFaturamentoStatus]);

  const navGroups = NAV_GROUPS
    .filter(g => !g.donoOnly || isCliente)
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.donoOnly || isCliente),
    }))
    .filter(g => g.items.length > 0);

  const todosOsItems = navGroups.flatMap(g => g.items);
  const { dark, toggle: toggleDark, mounted: darkMounted } = useDarkMode();

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [helpAberto, setHelpAberto] = useState(false);
  const [mostrarNps, setMostrarNps] = useState(false);
  const [colapsada, setColapsada] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-cliente-colapsada') === 'true';
  });

  const toggleColapsada = () => {
    setColapsada((v) => {
      localStorage.setItem('sidebar-cliente-colapsada', String(!v));
      return !v;
    });
  };

  const [wsToken, setWsToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    getToken().then(setWsToken).catch(() => setWsToken(undefined));
  }, [getToken]);

  const { status, notificacoes, naoLidas, marcarComoLida, marcarTodasLidas, limpar } =
    useNotificacoes(wsToken);

  const { logoUrl, nomeEscritorio } = useTheme(token);
  const { formatado: tempoSessao, critico: sessaoCritica, urgente: sessaoUrgente } = useSessionTimer();

  const [userMenuAberto, setUserMenuAberto] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuAberto) return;
    const handler = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuAberto]);

  const [notifAberto, setNotifAberto] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!notifAberto) return;
    const handler = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) setNotifAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifAberto]);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [logout, router]);

  useEffect(() => {
    if (carregando) return;
    if (!usuario) { router.push('/login'); return; }
    if (!isCliente && !isFuncionarioCliente) router.push('/dashboard');
  }, [carregando, usuario, isCliente, isFuncionarioCliente, router]);

  useEffect(() => {
    if (!usuario || !token) return;
    fetch('/api/v1/nps', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { exibir?: boolean }) => { if (d.exibir) setMostrarNps(true); })
      .catch(() => {/* ignorar erros silenciosamente */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50 dark:bg-gray-900">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!usuario) return null;

  const iniciais = usuario.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const statusWs = STATUS_CONFIG[status];

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Ir para o conteúdo
      </a>

      {/* Overlay mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* ================================================================ */}
      {/* Sidebar                                                            */}
      {/* ================================================================ */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${colapsada ? 'w-16' : 'w-64'}
          bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800
          flex flex-col transition-all duration-300 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-100 dark:border-gray-800 shrink-0 ${colapsada ? 'justify-center' : 'gap-3 px-5'}`}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
          )}
          {!colapsada && (
            <>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {nomeEscritorio || 'Portal do Cliente'}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">FiscoHub</p>
              </div>
              <button
                className="ml-auto lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setSidebarAberta(false)}
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>

        {/* Navegação */}
        <nav className={`flex-1 py-4 overflow-y-auto ${colapsada ? 'px-2' : 'px-3'}`}>
          {navGroups.map((grupo, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {/* Label do grupo (só quando expandida e grupo tem label) */}
              {!colapsada && grupo.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                  {grupo.label}
                </p>
              )}
              <div className="space-y-0.5">
                {grupo.items.map((item) => {
                  const ativo = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarAberta(false)}
                      title={colapsada ? item.label : undefined}
                      className={`
                        flex items-center rounded-lg text-sm font-medium transition-colors
                        ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'}
                        ${ativo
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        }
                      `}
                    >
                      <span className={`shrink-0 ${ativo ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
                        {item.icon}
                      </span>
                      {!colapsada && item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Status WS + Perfil */}
        <div className={`border-t border-gray-100 dark:border-gray-800 py-3 shrink-0 space-y-2 ${colapsada ? 'px-2' : 'px-3'}`}>
          <div className={`flex items-center gap-2 ${colapsada ? 'justify-center py-1' : 'px-3 py-1.5'}`}>
            <span title={colapsada ? statusWs.label : undefined} className={`w-2 h-2 rounded-full shrink-0 ${statusWs.cor}`} />
            {!colapsada && <span className="text-[11px] text-gray-500 dark:text-gray-400">{statusWs.label}</span>}
          </div>

          <div className={`flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 ${colapsada ? 'justify-center p-2' : 'gap-3 px-3 py-2'}`}>
            <div title={colapsada ? usuario.nome : undefined} className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-xs font-bold shrink-0">
              {iniciais}
            </div>
            {!colapsada && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ================================================================ */}
      {/* Área de conteúdo                                                   */}
      {/* ================================================================ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <button
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarAberta(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={toggleColapsada}
              aria-label={colapsada ? 'Expandir sidebar' : 'Recolher sidebar'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {colapsada ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
            <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {todosOsItems.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Portal'}
            </h1>
          </div>

          <div className="flex items-center gap-2 ml-auto">

            {/* Timer de sessão */}
            {tempoSessao && (
              <div
                title="Tempo restante da sessão"
                className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors ${
                  sessaoUrgente
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 animate-pulse'
                    : sessaoCritica
                    ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                <Clock size={11} />
                {tempoSessao}
              </div>
            )}

            {/* Botão Central de Ajuda */}
            <button
              onClick={() => setHelpAberto(true)}
              aria-label="Ajuda & Tutoriais"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <HelpCircle size={18} />
            </button>

            {/* Botão Dark Mode */}
            {darkMounted && (
              <button
                onClick={toggleDark}
                aria-label={dark ? 'Modo claro' : 'Modo escuro'}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            {/* Notificações */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifAberto((v) => !v)}
                className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={`Notificações${naoLidas > 0 ? ` — ${naoLidas} não lidas` : ''}`}
                aria-expanded={notifAberto}
              >
                <Bell size={18} />
                {naoLidas > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {naoLidas > 99 ? '99+' : naoLidas}
                  </span>
                )}
              </button>

              {notifAberto && (
                <div className="absolute right-0 top-full mt-1 w-[calc(100vw-1rem)] max-w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Notificações</span>
                    <div className="flex gap-3">
                      {naoLidas > 0 && (
                        <button onClick={marcarTodasLidas} className="text-[10px] text-primary hover:underline">
                          Marcar todas como lidas
                        </button>
                      )}
                      {notificacoes.length > 0 && (
                        <button onClick={limpar} className="text-[10px] text-gray-400 hover:text-red-500">
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {notificacoes.length === 0 ? (
                      <li className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">Nenhuma notificação</li>
                    ) : (
                      notificacoes.map((n) => (
                        <li
                          key={n.id}
                          className={`${!n.lida ? 'bg-primary-50 dark:bg-primary/10' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => marcarComoLida(n.id)}
                            className="w-full text-left flex gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">{n.titulo}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{n.mensagem}</p>
                              <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">
                                {n.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Dropdown do usuário */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuAberto((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-3 min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={`Menu de ${usuario.nome}`}
                aria-expanded={userMenuAberto}
              >
                <div className="w-7 h-7 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-[10px] font-bold">
                  {iniciais}
                </div>
                <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {usuario.nome}
                </span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {userMenuAberto && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut size={14} />
                    Sair do sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Children */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>

        <InstitutionalFooter />
      </div>
      <ClientHelpTutorialModal aberto={helpAberto} onClose={() => setHelpAberto(false)} />
      {mostrarNps && (
        <NpsModal token={token} onFechar={() => setMostrarNps(false)} />
      )}
      {bloqueioSaaS?.bloqueado && (
        <ModalBloqueioInadimplencia
          cobranca={bloqueioSaaS.cobranca}
          onCheckStatus={checkFaturamentoStatus}
        />
      )}
    </div>
  );
}
