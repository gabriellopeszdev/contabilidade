'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Upload, Users, Settings, FileText, HelpCircle,
  LogOut, Menu, X, Loader2, Bell, ChevronDown, Building2,
  MessageSquare, CalendarDays, UserCog, DollarSign, Home,
  Sun, Moon, FileBarChart, PenLine, Search, ChevronsLeft, ChevronsRight,
  Bot, Lock, ClipboardList, Clock,
} from 'lucide-react';
import { FiscoHubLogo } from '../components/FiscoHubLogo';

import { useAuth }         from '../../src/presentation/hooks/useAuth';
import { useDarkMode }     from '../../src/presentation/hooks/useDarkMode';
import { useTheme }        from '../../src/presentation/hooks/useTheme';
import { useNotificacoes, type StatusConexao } from '../../src/presentation/hooks/useNotificacoes';
import { useSessionTimer } from '../../src/presentation/hooks/useSessionTimer';
import { usePlanoAtual }   from '../../src/presentation/hooks/usePlanoAtual';
import { InstitutionalFooter } from '../../src/presentation/components/lgpd/InstitutionalFooter';
import { HelpTutorialModal } from '../(contador)/components/HelpTutorialModal';
import { ClientHelpTutorialModal } from '../(cliente)/components/ClientHelpTutorialModal';

// =============================================================================
// Nav — Contador (com grupos)
// =============================================================================

interface NavItem {
  href:      string;
  label:     string;
  icon:      React.ReactNode;
  donoOnly?: boolean;
  feature?:  string;
}

interface NavGroup {
  label?: string;
  items:  NavItem[];
}

const NAV_GRUPOS_CONTADOR: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    label: 'Documentos',
    items: [
      { href: '/nfe',  label: 'NF-e dos Clientes',  icon: <FileText size={18} />, donoOnly: true },
      { href: '/lote', label: 'Upload em Lote', icon: <Upload   size={18} /> },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { href: '/clientes', label: 'Meus Clientes', icon: <Users   size={18} /> },
      { href: '/equipe',   label: 'Equipe',         icon: <UserCog size={18} />, donoOnly: true, feature: 'equipe' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/kanban',      label: 'Kanban',      icon: <ClipboardList size={18} /> },
      { href: '/calendario',  label: 'Calendário',  icon: <CalendarDays size={18} />,              feature: 'calendario' },
      { href: '/financeiro',  label: 'Financeiro',  icon: <DollarSign   size={18} />, donoOnly: true, feature: 'financeiro' },
      { href: '/relatorios',  label: 'Relatórios',  icon: <FileBarChart size={18} />, donoOnly: true, feature: 'relatorios' },
      { href: '/assinaturas', label: 'Assinaturas', icon: <PenLine      size={18} />, donoOnly: true, feature: 'assinatura_eletronica' },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { href: '/chat',    label: 'Chat',    icon: <MessageSquare size={18} />,            feature: 'chat' },
      { href: '/chat-ia', label: 'Chat IA', icon: <Bot           size={18} />, donoOnly: true, feature: 'ia' },
    ],
  },
  {
    items: [
      { href: '/busca',         label: 'Busca',         icon: <Search   size={18} /> },
      { href: '/configuracoes', label: 'Configurações', icon: <Settings size={18} />, donoOnly: true },
    ],
  },
];

// =============================================================================
// Nav — Cliente (com grupos, igual ao layout principal do cliente)
// =============================================================================

interface NavGrupoCliente { label?: string; donoOnly?: boolean; items: NavItem[]; }

const NAV_GRUPOS_CLIENTE: NavGrupoCliente[] = [
  {
    items: [
      { href: '/inicio', label: 'Início', icon: <Home size={18} /> },
    ],
  },
  {
    label: 'Documentos',
    items: [
      { href: '/documentos',         label: 'Meus Documentos', icon: <FileText size={18} /> },
      { href: '/enviar',             label: 'Enviar Arquivo',  icon: <Upload   size={18} /> },
      { href: '/minhas-assinaturas', label: 'Assinaturas',     icon: <PenLine  size={18} /> },
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
// WS status
// =============================================================================

const STATUS_CONFIG: Record<StatusConexao, { label: string; cor: string }> = {
  desconectado: { label: 'Offline',         cor: 'bg-gray-400' },
  conectando:   { label: 'Conectando…',     cor: 'bg-yellow-400 animate-pulse' },
  conectado:    { label: 'Online',          cor: 'bg-emerald-500' },
  reconectando: { label: 'Reconectando…',   cor: 'bg-yellow-400 animate-pulse' },
  erro_auth:    { label: 'Sessão expirada', cor: 'bg-red-500' },
};

// =============================================================================
// Layout compartilhado /chat — detecta role e exibe sidebar correta
// =============================================================================

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const { usuario, token, carregando, logout, getToken, isCliente, isFuncionarioCliente, isDono } = useAuth();
  const isVisaoCliente = isCliente || isFuncionarioCliente;

  const { dark, toggle: toggleDark, mounted: darkMounted } = useDarkMode();
  const { plan: planoAtual } = usePlanoAtual(isDono ? token : null);
  const { logoUrl, nomeEscritorio, loaded: themeLoaded } = useTheme(token);
  const { formatado: tempoSessao } = useSessionTimer();

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [helpAberto, setHelpAberto] = useState(false);
  const [colapsada,     setColapsada]     = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('sidebar-cliente-colapsada') === 'true' ||
      localStorage.getItem('sidebar-colapsada') === 'true'
    );
  });

  // Após auth carregar, garante que a chave correta é usada
  useEffect(() => {
    if (carregando) return;
    const key = isVisaoCliente ? 'sidebar-cliente-colapsada' : 'sidebar-colapsada';
    setColapsada(localStorage.getItem(key) === 'true');
  }, [carregando, isVisaoCliente]);

  const toggleColapsada = () => {
    setColapsada((v) => {
      const key = isVisaoCliente ? 'sidebar-cliente-colapsada' : 'sidebar-colapsada';
      localStorage.setItem(key, String(!v));
      return !v;
    });
  };

  const [wsToken, setWsToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    getToken().then(setWsToken).catch(() => setWsToken(undefined));
  }, [getToken]);

  const { status, notificacoes, naoLidas, marcarComoLida, marcarTodasLidas, limpar } =
    useNotificacoes(wsToken);

  const [userMenuAberto, setUserMenuAberto] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuAberto) return;
    const h = (e: MouseEvent) => { if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuAberto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [userMenuAberto]);

  const [notifAberto, setNotifAberto] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!notifAberto) return;
    const h = (e: MouseEvent) => { if (!notifRef.current?.contains(e.target as Node)) setNotifAberto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifAberto]);

  const handleLogout = useCallback(() => { logout(); router.push('/login'); }, [logout, router]);

  useEffect(() => {
    if (!carregando && !usuario) router.push('/login');
  }, [carregando, usuario, router]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!usuario) return null;

  const iniciais = usuario.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const statusWs = STATUS_CONFIG[status];

  // ============================================================
  // Sidebar do CLIENTE
  // ============================================================
  if (isVisaoCliente) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        {sidebarAberta && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarAberta(false)} />
        )}

        <aside className={`fixed lg:static inset-y-0 left-0 z-50 ${colapsada ? 'w-16' : 'w-64'} bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className={`h-16 flex items-center border-b border-gray-100 dark:border-gray-800 shrink-0 ${colapsada ? 'justify-center' : 'gap-3 px-4'}`}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
              : <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0"><Building2 size={16} className="text-white" /></div>
            }
            {!colapsada && (
              <>
                <div className="min-w-0 flex-1">
                  {themeLoaded
                    ? <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{nomeEscritorio || 'Portal do Cliente'}</p>
                    : <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                  }
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">FiscoHub</p>
                </div>
                <button className="ml-auto lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => setSidebarAberta(false)}><X size={18} /></button>
              </>
            )}
          </div>

          <nav className={`flex-1 py-4 overflow-y-auto ${colapsada ? 'px-2' : 'px-3'}`}>
            {NAV_GRUPOS_CLIENTE
              .filter((g) => !g.donoOnly || isCliente)
              .map((grupo, gi) => (
                <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
                  {!colapsada && grupo.label && (
                    <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                      {grupo.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {grupo.items.filter((item) => !item.donoOnly || isCliente).map((item) => {
                      const ativo = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setSidebarAberta(false)} title={colapsada ? item.label : undefined}
                          className={`flex items-center rounded-lg text-sm font-medium transition-colors ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'} ${ativo ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                          <span className={`shrink-0 ${ativo ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>{item.icon}</span>
                          {!colapsada && item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
          </nav>

          <div className={`border-t border-gray-100 dark:border-gray-800 py-3 shrink-0 space-y-2 ${colapsada ? 'px-2' : 'px-3'}`}>
            <div className={`flex items-center gap-2 ${colapsada ? 'justify-center py-1' : 'px-3 py-1'}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusWs.cor}`} />
              {!colapsada && <span className="text-[11px] text-gray-500 dark:text-gray-400">{statusWs.label}</span>}
            </div>
            <div className={`flex items-center rounded-lg bg-primary-50/60 dark:bg-gray-800 ${colapsada ? 'justify-center p-2' : 'gap-3 px-3 py-2'}`}>
              <div title={colapsada ? usuario.nome : undefined} className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-xs font-bold shrink-0">{iniciais}</div>
              {!colapsada && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
            <button className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setSidebarAberta(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <div className="hidden lg:flex items-center gap-2">
              <button onClick={toggleColapsada} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{colapsada ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}</button>
              <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {NAV_GRUPOS_CLIENTE.flatMap((g) => g.items).find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Portal'}
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {tempoSessao && (
                <div title="Tempo restante da sessão" className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <Clock size={11} />
                  {tempoSessao}
                </div>
              )}
              <button
                onClick={() => setHelpAberto(true)}
                title="Ajuda & Tutoriais"
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <HelpCircle size={18} />
              </button>
              {darkMounted && <button onClick={toggleDark} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>}
              <div ref={notifRef} className="relative">
                <button onClick={() => setNotifAberto((v) => !v)} className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={`Notificações${naoLidas > 0 ? ` — ${naoLidas} não lidas` : ''}`}>
                  <Bell size={18} />
                  {naoLidas > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">{naoLidas > 99 ? '99+' : naoLidas}</span>}
                </button>
                {notifAberto && (
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Notificações</span>
                      <div className="flex gap-3">
                        {naoLidas > 0 && <button onClick={marcarTodasLidas} className="text-[10px] text-primary hover:underline">Marcar todas como lidas</button>}
                        {notificacoes.length > 0 && <button onClick={limpar} className="text-[10px] text-gray-400 hover:text-red-500">Limpar</button>}
                      </div>
                    </div>
                    <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                      {notificacoes.length === 0
                        ? <li className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">Nenhuma notificação</li>
                        : notificacoes.map((n) => (
                          <li key={n.id} onClick={() => marcarComoLida(n.id)} className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!n.lida ? 'bg-primary-50 dark:bg-primary/10' : ''}`}>
                            <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">{n.titulo}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{n.mensagem}</p>
                            <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">{n.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                )}
              </div>
              <div ref={userMenuRef} className="relative">
                <button onClick={() => setUserMenuAberto((v) => !v)} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-[10px] font-bold">{iniciais}</div>
                  <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{usuario.nome}</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {userMenuAberto && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"><LogOut size={14} />Sair do sistema</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
          <InstitutionalFooter />
        </div>
        {isVisaoCliente ? (
          <ClientHelpTutorialModal aberto={helpAberto} onClose={() => setHelpAberto(false)} />
        ) : (
          <HelpTutorialModal aberto={helpAberto} onClose={() => setHelpAberto(false)} />
        )}
      </div>
    );
  }

  // ============================================================
  // Sidebar do CONTADOR (com grupos e feature locking)
  // ============================================================

  const navGroups = NAV_GRUPOS_CONTADOR.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.donoOnly || isDono),
  })).filter((g) => g.items.length > 0);

  const navItems = navGroups.flatMap((g) => g.items);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {sidebarAberta && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarAberta(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 ${colapsada ? 'w-16' : 'w-64'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`h-16 flex items-center border-b border-gray-100 dark:border-gray-800 shrink-0 ${colapsada ? 'justify-center' : 'gap-3 px-4'}`}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
            : <FiscoHubLogo size="sm" variant={colapsada ? 'icon' : 'full'} />
          }
          {!colapsada && (
            <button className="ml-auto lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => setSidebarAberta(false)}><X size={18} /></button>
          )}
        </div>

        <nav className={`flex-1 py-3 overflow-y-auto ${colapsada ? 'px-2' : 'px-3'}`}>
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {gi > 0 && (
                colapsada
                  ? <div className="my-2 border-t border-gray-100 dark:border-gray-800" />
                  : group.label && (
                    <p className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 select-none">
                      {group.label}
                    </p>
                  )
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const ativo = pathname === item.href || pathname.startsWith(item.href + '/');
                  const bloqueado = isDono && item.feature && planoAtual
                    ? planoAtual.isRestricted || !planoAtual.features.includes(item.feature)
                    : false;

                  if (bloqueado) {
                    return (
                      <div key={item.href} title={`Indisponível no plano ${planoAtual?.planoNome ?? 'atual'}`}
                        className={`flex items-center rounded-lg text-sm font-medium cursor-not-allowed opacity-50 ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'} text-gray-400 dark:text-gray-600`}>
                        <span className="shrink-0 text-gray-300 dark:text-gray-600">{item.icon}</span>
                        {!colapsada && <><span className="flex-1">{item.label}</span><Lock size={12} className="shrink-0 text-gray-300 dark:text-gray-600" /></>}
                      </div>
                    );
                  }

                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSidebarAberta(false)}
                      className={`flex items-center rounded-lg text-sm font-medium transition-colors ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'} ${ativo ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                      <span className={`shrink-0 ${ativo ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>{item.icon}</span>
                      {!colapsada && item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`border-t border-gray-100 dark:border-gray-800 py-3 shrink-0 space-y-2 ${colapsada ? 'px-2' : 'px-3'}`}>
          <div className={`flex items-center gap-2 ${colapsada ? 'justify-center py-1' : 'px-3 py-1'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusWs.cor}`} />
            {!colapsada && <span className="text-[11px] text-gray-500 dark:text-gray-400">{statusWs.label}</span>}
          </div>
          <div className={`flex items-center rounded-lg bg-gray-50 dark:bg-gray-800 ${colapsada ? 'justify-center p-2' : 'gap-3 px-3 py-2'}`}>
            <div title={colapsada ? usuario.nome : undefined} className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-xs font-bold shrink-0">{iniciais}</div>
            {!colapsada && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.role}</p>
                {isDono && planoAtual && (
                  <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20">{planoAtual.planoNome}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <button className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setSidebarAberta(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={toggleColapsada} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{colapsada ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}</button>
            <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {navItems.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Chat'}
            </h1>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {tempoSessao && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {tempoSessao}
              </div>
            )}
            {/* Botão Central de Ajuda */}
            <button
              onClick={() => setHelpAberto(true)}
              title="Ajuda & Tutoriais"
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <HelpCircle size={18} />
            </button>
            {darkMounted && <button onClick={toggleDark} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>}

            <div ref={notifRef} className="relative">
              <button onClick={() => setNotifAberto((v) => !v)} className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Notificações">
                <Bell size={18} />
                {naoLidas > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">{naoLidas > 99 ? '99+' : naoLidas}</span>}
              </button>
              {notifAberto && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Notificações</span>
                    <div className="flex gap-3">
                      {naoLidas > 0 && <button onClick={marcarTodasLidas} className="text-[10px] text-primary hover:underline">Marcar todas como lidas</button>}
                      {notificacoes.length > 0 && <button onClick={limpar} className="text-[10px] text-gray-400 hover:text-red-500">Limpar</button>}
                    </div>
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {notificacoes.length === 0
                      ? <li className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">Nenhuma notificação</li>
                      : notificacoes.map((n) => (
                        <li key={n.id} onClick={() => marcarComoLida(n.id)} className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!n.lida ? 'bg-primary-50/40 dark:bg-primary/10' : ''}`}>
                          <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">{n.titulo}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{n.mensagem}</p>
                        </li>
                      ))
                    }
                  </ul>
                </div>
              )}
            </div>

            <div ref={userMenuRef} className="relative">
              <button onClick={() => setUserMenuAberto((v) => !v)} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-[10px] font-bold">{iniciais}</div>
                <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{usuario.nome}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {userMenuAberto && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"><LogOut size={14} />Sair do sistema</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
        <InstitutionalFooter />
      </div>
      {isVisaoCliente ? (
        <ClientHelpTutorialModal aberto={helpAberto} onClose={() => setHelpAberto(false)} />
      ) : (
        <HelpTutorialModal aberto={helpAberto} onClose={() => setHelpAberto(false)} />
      )}
    </div>
  );
}
