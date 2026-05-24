'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Upload,
  Users,
  Settings,
  FileText,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Loader2,
  Bell,
  ChevronDown,
  Building2,
  MessageSquare,
  CalendarDays,
  UserCog,
  DollarSign,
  Home,
} from 'lucide-react';

import { useAuth } from '../../src/presentation/hooks/useAuth';
import { useTheme } from '../../src/presentation/hooks/useTheme';
import {
  useNotificacoes,
  type StatusConexao,
} from '../../src/presentation/hooks/useNotificacoes';
import { InstitutionalFooter } from '../../src/presentation/components/lgpd/InstitutionalFooter';

// =============================================================================
// Navegação por role
// =============================================================================

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
  donoOnly?: boolean;
}

const NAV_CONTADOR: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',       icon: <LayoutDashboard size={18} /> },
  { href: '/lote',          label: 'Upload em Lote',   icon: <Upload size={18} /> },
  { href: '/clientes',      label: 'Meus Clientes',   icon: <Users size={18} /> },
  { href: '/equipe',        label: 'Equipe',           icon: <UserCog size={18} />,       donoOnly: true },
  { href: '/calendario',    label: 'Calendário',      icon: <CalendarDays size={18} /> },
  { href: '/financeiro',    label: 'Financeiro',       icon: <DollarSign size={18} />,     donoOnly: true },
  { href: '/chat',          label: 'Chat',             icon: <MessageSquare size={18} /> },
  { href: '/configuracoes', label: 'Configurações',    icon: <Settings size={18} />,      donoOnly: true },
];

const NAV_CLIENTE: NavItem[] = [
  { href: '/inicio',     label: 'Início',          icon: <Home       size={18} /> },
  { href: '/documentos', label: 'Meus Documentos', icon: <FileText   size={18} /> },
  { href: '/enviar',     label: 'Enviar Arquivo',  icon: <Upload     size={18} /> },
  { href: '/financeiro', label: 'Financeiro',      icon: <DollarSign size={18} /> },
  { href: '/chat',       label: 'Chat',            icon: <MessageSquare size={18} /> },
  { href: '/ajuda',      label: 'Ajuda',           icon: <HelpCircle size={18} /> },
];

const STATUS_CONFIG: Record<StatusConexao, { icon: React.ReactNode; label: string; cor: string }> = {
  desconectado: { icon: <WifiOff size={10} />, label: 'Offline',          cor: 'bg-gray-400' },
  conectando:   { icon: <Loader2 size={10} className="animate-spin" />, label: 'Conectando…',   cor: 'bg-yellow-400 animate-pulse' },
  conectado:    { icon: <Wifi size={10} />,    label: 'Online',           cor: 'bg-emerald-500' },
  reconectando: { icon: <Loader2 size={10} className="animate-spin" />, label: 'Reconectando…', cor: 'bg-yellow-400 animate-pulse' },
  erro_auth:    { icon: <WifiOff size={10} />, label: 'Sessão expirada', cor: 'bg-red-500' },
};

// =============================================================================
// Layout do Financeiro (compartilhado entre Contador e Cliente)
// =============================================================================

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const { usuario, carregando, logout, getToken, isCliente, isFuncionarioCliente, isDono } = useAuth();
  const isVisaoCliente = isCliente || isFuncionarioCliente;

  const [sidebarAberta, setSidebarAberta] = useState(false);

  // Token
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setToken(t ?? null)).catch(() => setToken(null));
  }, [getToken]);

  // WS token
  const [wsToken, setWsToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    getToken().then(setWsToken).catch(() => setWsToken(undefined));
  }, [getToken]);

  const { status, notificacoes, naoLidas, marcarComoLida, marcarTodasLidas, limpar } =
    useNotificacoes(wsToken);

  // Aplicar tema White Label
  const { logoUrl, nomeEscritorio } = useTheme(token);

  // Dropdown do usuário
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

  // Painel de notificações
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
    router.push('/');
  }, [logout, router]);

  useEffect(() => {
    if (!carregando && !usuario) {
      router.push('/');
    }
  }, [carregando, usuario, router]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!usuario) return null;

  const navItems = isVisaoCliente
    ? NAV_CLIENTE
    : NAV_CONTADOR.filter((item) => !item.donoOnly || isDono);
  const accentColor = isVisaoCliente ? 'sky' : 'blue';

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

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          flex flex-col transition-transform duration-200 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className={`w-8 h-8 rounded-lg bg-${accentColor}-600 flex items-center justify-center`}>
              {isVisaoCliente
                ? <Building2 size={16} className="text-white" />
                : <LayoutDashboard size={16} className="text-white" />}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {nomeEscritorio || (isVisaoCliente ? 'Portal do Cliente' : 'Gestão Contábil')}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">
              {isVisaoCliente ? 'Gestão Contábil' : 'Painel Administrativo'}
            </p>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setSidebarAberta(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarAberta(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${ativo
                    ? `bg-${accentColor}-50 dark:bg-${accentColor}-900/20 text-${accentColor}-700 dark:text-${accentColor}-400`
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  }
                `}
              >
                <span className={ativo ? `text-${accentColor}-600 dark:text-${accentColor}-400` : 'text-gray-400 dark:text-gray-500'}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status WS + Perfil */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3 space-y-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className={`w-2 h-2 rounded-full ${statusWs.cor}`} />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{statusWs.label}</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className={`w-8 h-8 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900/30 text-${accentColor}-700 dark:text-${accentColor}-400 flex items-center justify-center text-xs font-bold shrink-0`}>
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarAberta(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:block">
            <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Financeiro</h1>
          </div>

          <div className="flex items-center gap-2 ml-auto">
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
                        <button onClick={marcarTodasLidas} className="text-[10px] text-blue-600 hover:underline">
                          Marcar todas como lidas
                        </button>
                      )}
                      {notificacoes.length > 0 && (
                        <button onClick={limpar} className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-red-500">
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
                          className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!n.lida ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                        >
                          <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                            {n.tipo === 'novoDocumentoUpload'
                              ? 'Upload concluído'
                              : n.tipo === 'documentoVisualizado'
                              ? 'Documento visualizado'
                              : n.tipo === 'novoBoletoHonorario'
                              ? 'Novo boleto'
                              : 'Nova mensagem'}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{n.mensagem}</p>
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
                <div className={`w-7 h-7 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900/30 text-${accentColor}-700 dark:text-${accentColor}-400 flex items-center justify-center text-[10px] font-bold`}>
                  {iniciais}
                </div>
                <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {usuario.nome}
                </span>
                <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
              </button>

              {userMenuAberto && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nome}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{usuario.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <InstitutionalFooter />
      </div>
    </div>
  );
}
