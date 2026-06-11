'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
  ShieldCheck,
  LayoutDashboard,
  Users,
  Receipt,
  Activity,
  Package,
  ShieldAlert,
  Shield,
} from 'lucide-react';

import { useAuth } from '../../src/presentation/hooks/useAuth';

// =============================================================================
// Navegação do Super Admin
// =============================================================================

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard-admin', label: 'Dashboard',        icon: <LayoutDashboard size={18} /> },
  { href: '/contadores',      label: 'Clientes',         icon: <Users           size={18} /> },
  { href: '/admin-boletos',   label: 'Boletos',          icon: <Receipt         size={18} /> },
  { href: '/planos',          label: 'Planos',           icon: <Package         size={18} /> },
  { href: '/faturamento',     label: 'Faturamento SaaS', icon: <CreditCard      size={18} /> },
  { href: '/webhook-logs',    label: 'Log de Webhooks',  icon: <Activity        size={18} /> },
  { href: '/auditoria',       label: 'Auditoria',        icon: <Shield          size={18} /> },
  { href: '/admin-config',    label: 'Configurações',    icon: <Settings        size={18} /> },
];

// =============================================================================
// Layout do Super Admin
// =============================================================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const { usuario, token, carregando, logout, isAdmin } = useAuth();

  const [sidebarAberta,    setSidebarAberta]    = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);

  // Guard: redireciona não-admins
  useEffect(() => {
    if (carregando) return;
    if (!usuario) {
      router.push('/login');
      return;
    }
    if (!isAdmin) {
      router.push(usuario.role === 'Cliente' ? '/documentos' : '/dashboard');
    }
  }, [carregando, usuario, isAdmin, router]);

  // Verifica se o admin tem 2FA ativo
  useEffect(() => {
    if (!token || !isAdmin) return;
    fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { usuario?: { twoFactorEnabled?: boolean } }) => {
        setTwoFactorEnabled(d.usuario?.twoFactorEnabled ?? false);
      })
      .catch(() => setTwoFactorEnabled(true)); // em caso de erro, não bloqueia
  }, [token, isAdmin]);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [logout, router]);

  if (carregando || !usuario || !isAdmin || twoFactorEnabled === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  const iniciais = usuario.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">

      {/* ================================================================== */}
      {/* Sidebar                                                              */}
      {/* ================================================================== */}

      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64
          bg-slate-900 border-r border-slate-800
          flex flex-col transition-transform duration-200
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Cabeçalho da sidebar */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Super Admin</p>
            <p className="text-[10px] text-slate-400 leading-none">Painel de Controle</p>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded text-slate-400 hover:text-white"
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
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors
                  ${ativo
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
                `}
              >
                <span className={ativo ? 'text-violet-400' : 'text-slate-500'}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: perfil + logout */}
        <div className="border-t border-slate-800 px-3 py-3 shrink-0 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-violet-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-100 truncate">{usuario.nome}</p>
              <p className="text-[10px] text-violet-400 truncate">Administrador</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </aside>

      {/* ================================================================== */}
      {/* Área principal                                                        */}
      {/* ================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">

        {/* Topbar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 sm:px-6 shrink-0">
          <button
            className="lg:hidden p-2 -ml-2 rounded text-slate-400 hover:text-white"
            onClick={() => setSidebarAberta(true)}
          >
            <Menu size={20} />
          </button>
          <div className="ml-2 lg:ml-0">
            <span className="text-xs font-semibold text-slate-300">
              {NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Admin'}
            </span>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-violet-300 bg-violet-900/40 border border-violet-700/50 px-2 py-1 rounded-full">
              <ShieldCheck size={10} />
              Super Admin
            </span>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* Overlay de 2FA obrigatório */}
          {twoFactorEnabled === false && pathname !== '/admin-config' && (
            <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-slate-900 border border-red-700/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert size={28} className="text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Autenticação em 2 fatores obrigatória</h2>
                <p className="text-sm text-slate-400 mb-6">
                  Por segurança, contas de administrador devem ter 2FA ativo. Configure agora para acessar o painel.
                </p>
                <Link
                  href="/admin-config"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <ShieldCheck size={16} />
                  Configurar 2FA agora
                </Link>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
