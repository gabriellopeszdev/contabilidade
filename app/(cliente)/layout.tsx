'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';

import { useAuth } from '../../src/presentation/hooks/useAuth';
import {
  useNotificacoes,
  type StatusConexao,
} from '../../src/presentation/hooks/useNotificacoes';
import { useTheme } from '../../src/presentation/hooks/useTheme';
import { useSessionTimer } from '../../src/presentation/hooks/useSessionTimer';
import { InstitutionalFooter } from '../../src/presentation/components/lgpd/InstitutionalFooter';

// =============================================================================
// Navegação da Sidebar
// =============================================================================

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/inicio',     label: 'Início',           icon: <Home       size={18} /> },
  { href: '/documentos', label: 'Meus Documentos',  icon: <FileText   size={18} /> },
  { href: '/enviar',     label: 'Enviar Arquivo',   icon: <Upload     size={18} /> },
  { href: '/financeiro', label: 'Financeiro',       icon: <DollarSign size={18} /> },
  { href: '/chat',       label: 'Chat',             icon: <MessageSquare size={18} /> },
  { href: '/ajuda',      label: 'Ajuda',            icon: <HelpCircle size={18} /> },
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

  // Sidebar mobile
  const [sidebarAberta, setSidebarAberta] = useState(false);

  // WS token
  const [wsToken, setWsToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    getToken().then(setWsToken).catch(() => setWsToken(undefined));
  }, [getToken]);

  const { status, notificacoes, naoLidas, marcarComoLida, marcarTodasLidas, limpar } =
    useNotificacoes(wsToken);

  // Aplicar tema White Label do escritório
  const { logoUrl, nomeEscritorio } = useTheme(token);

  const { formatado: tempoSessao, critico: sessaoCritica, urgente: sessaoUrgente } = useSessionTimer();

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

  // Logout
  const handleLogout = useCallback(() => {
    logout();
    router.push('/');
  }, [logout, router]);

  // Redirect — não autenticado ou role incorreto
  useEffect(() => {
    if (carregando) return;
    if (!usuario) {
      router.push('/');
      return;
    }
    if (!isCliente && !isFuncionarioCliente) {
      router.push('/dashboard');
    }
  }, [carregando, usuario, isCliente, isFuncionarioCliente, router]);

  // Loading
  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen bg-sky-50">
        <Loader2 size={32} className="animate-spin text-sky-600" />
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
    <div className="flex h-screen bg-sky-50/40 overflow-hidden">

      {/* ================================================================== */}
      {/* Sidebar                                                              */}
      {/* ================================================================== */}

      {/* Overlay mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-sky-100
          flex flex-col transition-transform duration-200 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sky-100 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{nomeEscritorio || 'Portal do Cliente'}</p>
            <p className="text-[10px] text-gray-400 leading-none">Gestão Contábil</p>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarAberta(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarAberta(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${ativo
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <span className={ativo ? 'text-sky-600' : 'text-gray-400'}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status WS + Perfil */}
        <div className="border-t border-sky-100 px-3 py-3 space-y-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className={`w-2 h-2 rounded-full ${statusWs.cor}`} />
            <span className="text-[11px] text-gray-500">{statusWs.label}</span>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sky-50/60">
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0">
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{usuario.nome}</p>
              <p className="text-[10px] text-gray-400 truncate">{usuario.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ================================================================== */}
      {/* Área de conteúdo                                                      */}
      {/* ================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 bg-white border-b border-sky-100 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          {/* Menu mobile */}
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setSidebarAberta(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          {/* Título da página */}
          <div className="hidden lg:block">
            <h1 className="text-sm font-semibold text-gray-700">
              {NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Portal'}
            </h1>
          </div>

          {/* Ações direita */}
          <div className="flex items-center gap-2 ml-auto">

            {/* Timer de sessão */}
            {tempoSessao && (
              <div
                title="Tempo restante da sessão"
                className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors ${
                  sessaoUrgente
                    ? 'bg-red-100 text-red-700 animate-pulse'
                    : sessaoCritica
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Clock size={11} />
                {tempoSessao}
              </div>
            )}

            {/* Notificações */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifAberto((v) => !v)}
                className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-900">Notificações</span>
                    <div className="flex gap-3">
                      {naoLidas > 0 && (
                        <button onClick={marcarTodasLidas} className="text-[10px] text-sky-600 hover:underline">
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
                  <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notificacoes.length === 0 ? (
                      <li className="py-8 text-center text-xs text-gray-400">Nenhuma notificação</li>
                    ) : (
                      notificacoes.map((n) => (
                        <li
                          key={n.id}
                          onClick={() => marcarComoLida(n.id)}
                          className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${!n.lida ? 'bg-sky-50/40' : ''}`}
                        >
                          <p className="text-[11px] font-semibold text-gray-800">
                            {n.tipo === 'novoBoletoHonorario'
                              ? `Novo boleto: R$ ${((n.payload as import('../../src/presentation/hooks/useNotificacoes').PayloadNovoBoleto).valor ?? 0).toFixed(2)}`
                              : n.tipo === 'novoDocumentoUpload'
                              ? `${(n.payload as import('../../src/presentation/hooks/useNotificacoes').PayloadNovoUpload).totalUploadados} documento(s) disponíveis`
                              : n.tipo === 'chat_notification'
                              ? 'Nova mensagem no chat'
                              : n.tipo === 'documentoVisualizado'
                              ? 'Documento visualizado'
                              : 'Notificação'}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{n.mensagem}</p>
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
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-bold">
                  {iniciais}
                </div>
                <span className="hidden sm:block text-xs font-medium text-gray-700 max-w-[120px] truncate">
                  {usuario.nome}
                </span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {userMenuAberto && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900 truncate">{usuario.nome}</p>
                    <p className="text-[10px] text-gray-400 truncate">{usuario.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
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
    </div>
  );
}
