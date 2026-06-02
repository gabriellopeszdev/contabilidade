'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Upload,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Loader2,
  Bell,
  ChevronDown,
  MessageSquare,
  CalendarDays,
  UserCog,
  DollarSign,
  FileBarChart,
  FileText,
  Clock,
  ClipboardList,
  Sun,
  Moon,
  Search,
  PenLine,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Bot,
} from 'lucide-react';
import { FiscoHubLogo } from '../components/FiscoHubLogo';

import { useAuth }          from '../../src/presentation/hooks/useAuth';
import { useNotificacoes, type StatusConexao } from '../../src/presentation/hooks/useNotificacoes';
import { useTheme }         from '../../src/presentation/hooks/useTheme';
import { useSessionTimer }  from '../../src/presentation/hooks/useSessionTimer';
import { useDarkMode }      from '../../src/presentation/hooks/useDarkMode';
import { usePlanoAtual }    from '../../src/presentation/hooks/usePlanoAtual';
import { InstitutionalFooter } from '../../src/presentation/components/lgpd/InstitutionalFooter';
import { OnboardingChecklist } from './components/OnboardingChecklist';
import { NpsModal } from './components/NpsModal';

// =============================================================================
// Navegação da Sidebar
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

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    label: 'Documentos',
    items: [
      { href: '/nfe',  label: 'Importar NF-e',  icon: <FileText size={18} />, donoOnly: true },
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
// Badge de status do WebSocket
// =============================================================================

const STATUS_CONFIG: Record<StatusConexao, { icon: React.ReactNode; label: string; cor: string }> = {
  desconectado: { icon: <WifiOff size={10} />,                                      label: 'Offline',          cor: 'bg-gray-400' },
  conectando:   { icon: <Loader2 size={10} className="animate-spin" />,             label: 'Conectando…',      cor: 'bg-yellow-400 animate-pulse' },
  conectado:    { icon: <Wifi size={10} />,                                          label: 'Online',           cor: 'bg-emerald-500' },
  reconectando: { icon: <Loader2 size={10} className="animate-spin" />,             label: 'Reconectando…',    cor: 'bg-yellow-400 animate-pulse' },
  erro_auth:    { icon: <WifiOff size={10} />,                                      label: 'Sessão expirada',  cor: 'bg-red-500' },
};

// =============================================================================
// Layout do Contador
// =============================================================================

export default function ContadorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const { usuario, token, carregando, logout, getToken, isDono, isContador } = useAuth();
  const { dark, toggle: toggleDark, mounted: darkMounted } = useDarkMode();

  const [sidebarAberta,  setSidebarAberta]  = useState(false);
  const [colapsada,      setColapsada]      = useState(false);

  useEffect(() => {
    if (localStorage.getItem('sidebar-colapsada') === 'true') setColapsada(true);
  }, []);

  const toggleColapsada = () => {
    setColapsada((v) => {
      localStorage.setItem('sidebar-colapsada', String(!v));
      return !v;
    });
  };

  const [wsToken, setWsToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    getToken().then(setWsToken).catch(() => setWsToken(undefined));
  }, [getToken]);

  const { status, notificacoes, naoLidas, marcarComoLida, marcarTodasLidas, limpar } =
    useNotificacoes(wsToken);

  const { logoUrl, nomeEscritorio, loaded: themeLoaded } = useTheme(token);
  const { plan: planoAtual } = usePlanoAtual(isDono ? token : null);
  const { formatado: tempoSessao, critico: sessaoCritica, urgente: sessaoUrgente } = useSessionTimer();

  // null = ainda carregando | true = concluído | false = pendente
  const [onboardingConcluido, setOnboardingConcluido] = useState<boolean | null>(null);
  useEffect(() => {
    if (!token || !isDono) return;
    fetch('/api/v1/onboarding', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOnboardingConcluido(d ? Boolean(d.concluido) : true))
      .catch(() => setOnboardingConcluido(true)); // fail-safe: não bloqueia
  }, [token, isDono]);

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
    if (!carregando && !usuario) router.push('/login');
  }, [carregando, usuario, router]);

  // Redireciona o dono para o onboarding enquanto não concluir
  useEffect(() => {
    if (!themeLoaded || carregando || !usuario || !isDono) return;
    if (onboardingConcluido === null) return; // aguarda carregar
    if (!nomeEscritorio || onboardingConcluido === false) router.push('/onboarding');
  }, [themeLoaded, nomeEscritorio, onboardingConcluido, carregando, usuario, isDono, router]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!usuario) return null;

  const navGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.donoOnly || isDono),
  })).filter((g) => g.items.length > 0);

  const navItems = navGroups.flatMap((g) => g.items);

  const iniciais = usuario.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const statusWs = STATUS_CONFIG[status];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

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
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          flex flex-col transition-all duration-300 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-100 dark:border-gray-800 shrink-0 ${colapsada ? 'justify-center' : 'gap-3 px-4'}`}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          ) : (
            <FiscoHubLogo size="sm" variant={colapsada ? 'icon' : 'full'} />
          )}
          {!colapsada && (
            <button
              className="ml-auto lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setSidebarAberta(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navegação */}
        <nav className={`flex-1 py-3 overflow-y-auto ${colapsada ? 'px-2' : 'px-3'}`}>
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {/* Separador + label do grupo */}
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

                  const title = colapsada
                    ? bloqueado ? `${item.label} — indisponível no plano ${planoAtual?.planoNome ?? 'atual'}` : item.label
                    : bloqueado ? `Indisponível no plano ${planoAtual?.planoNome ?? 'atual'} — faça upgrade` : undefined;

                  if (bloqueado) {
                    return (
                      <div
                        key={item.href}
                        title={title}
                        className={`
                          flex items-center rounded-lg text-sm font-medium cursor-not-allowed opacity-50
                          ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'}
                          text-gray-400 dark:text-gray-600
                        `}
                      >
                        <span className="shrink-0 text-gray-300 dark:text-gray-600">{item.icon}</span>
                        {!colapsada && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <Lock size={12} className="shrink-0 text-gray-300 dark:text-gray-600" />
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarAberta(false)}
                      title={title}
                      className={`
                        flex items-center rounded-lg text-sm font-medium transition-colors
                        ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'}
                        ${ativo
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        }
                      `}
                    >
                      <span className={`shrink-0 ${ativo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>{item.icon}</span>
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
          <div className={`flex items-center gap-2 ${colapsada ? 'justify-center py-1' : 'px-3 py-1'}`}>
            <span title={colapsada ? statusWs.label : undefined} className={`w-2 h-2 rounded-full shrink-0 ${statusWs.cor}`} />
            {!colapsada && <span className="text-[11px] text-gray-500 dark:text-gray-400">{statusWs.label}</span>}
          </div>

          <div className={`flex items-center rounded-lg bg-gray-50 dark:bg-gray-800 ${colapsada ? 'justify-center p-2' : 'gap-3 px-3 py-2'}`}>
            <div title={colapsada ? usuario.nome : undefined} className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
              {iniciais}
            </div>
            {!colapsada && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.role}</p>
                {isDono && planoAtual && (
                  <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20">
                    {planoAtual.planoNome}
                  </span>
                )}
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
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarAberta(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={toggleColapsada}
              title={colapsada ? 'Expandir sidebar' : 'Recolher sidebar'}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {colapsada ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
            <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {navItems.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Painel'}
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

            {/* Botão Dark Mode */}
            {darkMounted && (
              <button
                onClick={toggleDark}
                title={dark ? 'Modo claro' : 'Modo escuro'}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            {/* Notificações */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifAberto((v) => !v)}
                className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={`Notificações${naoLidas > 0 ? ` — ${naoLidas} não lidas` : ''}`}
              >
                <Bell size={18} />
                {naoLidas > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {naoLidas > 99 ? '99+' : naoLidas}
                  </span>
                )}
              </button>

              {notifAberto && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
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
                          onClick={() => marcarComoLida(n.id)}
                          className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!n.lida ? 'bg-primary-50/40 dark:bg-primary/10' : ''}`}
                        >
                          <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">{n.titulo}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{n.mensagem}</p>
                          <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">
                            {n.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
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
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">
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
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        <InstitutionalFooter />
      </div>
      <OnboardingChecklist />
      <NpsModal />
    </div>
  );
}
