'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Shield,
  Building2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  Download,
  LogIn,
  LogOut as LogOutIcon,
  FileText,
  UserX,
  Activity,
  Palette,
  Upload,
  Image as ImageIcon,
  CreditCard,
  XCircle,
  Check,
  Lock,
  Plug,
  KeyRound,
  Bell,
  QrCode,
  Copy,
  ExternalLink,
  RefreshCw,
  DollarSign,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { applyThemeCssVars } from '../../../src/presentation/hooks/useTheme';
import { validarEmail, validarTelefone, mascararTelefone } from '../../../src/utils/validators';

// =============================================================================
// Tipos
// =============================================================================

type Aba = 'perfil' | 'seguranca' | 'escritorio' | 'white-label' | 'privacidade' | 'assinatura' | 'integracoes' | 'notificacoes';

interface PerfilForm {
  nome:  string;
  email: string;
  phone: string;
}

interface SenhaForm {
  senhaAtual:     string;
  novaSenha:      string;
  confirmarSenha: string;
}

interface EscritorioForm {
  crc:   string;
  phone: string;
}

interface UsuarioAPI {
  id:               string;
  name:             string;
  email:            string;
  crc:              string;
  phone:            string | null;
  avatarUrl:        string | null;
  role:             string;
  twoFactorEnabled: boolean;
}

interface Toast {
  tipo:     'sucesso' | 'erro';
  mensagem: string;
}

// =============================================================================
// Abas do menu de configurações
// =============================================================================

const ABAS: { id: Aba; label: string; icon: React.ReactNode }[] = [
  { id: 'perfil',       label: 'Perfil',       icon: <User        size={18} /> },
  { id: 'seguranca',    label: 'Segurança',    icon: <Shield      size={18} /> },
  { id: 'escritorio',   label: 'Escritório',   icon: <Building2   size={18} /> },
  { id: 'white-label',  label: 'White Label',  icon: <Palette     size={18} /> },
  { id: 'privacidade',  label: 'Privacidade',  icon: <ShieldCheck size={18} /> },
  { id: 'assinatura',   label: 'Assinatura',   icon: <CreditCard  size={18} /> },
  { id: 'integracoes',  label: 'Integrações',  icon: <Plug        size={18} /> },
  { id: 'notificacoes', label: 'Notificações', icon: <Bell        size={18} /> },
];

// =============================================================================
// Página: /(contador)/configuracoes — Configurações do Contador
// =============================================================================

export default function ConfiguracoesPage() {
  const { token, usuario } = useAuth();

  const [abaAtiva, setAbaAtiva] = useState<Aba>('perfil');
  const [toast, setToast]       = useState<Toast | null>(null);

  // Dados do servidor
  const [dadosUsuario, setDadosUsuario] = useState<UsuarioAPI | null>(null);
  const [carregandoDados, setCarregandoDados] = useState(true);

  // ---------------------------------------------------------------------------
  // Carregar dados do perfil via GET /api/v1/auth/me
  // ---------------------------------------------------------------------------
  const carregarPerfil = useCallback(async () => {
    if (!token) return;
    setCarregandoDados(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Falha ao carregar perfil.');
      const data = await res.json();
      setDadosUsuario(data.usuario);
    } catch {
      mostrarToast('erro', 'Não foi possível carregar os dados do perfil.');
    } finally {
      setCarregandoDados(false);
    }
  }, [token]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  const mostrarToast = (tipo: Toast['tipo'], mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gerencie seu perfil, segurança e dados do escritório.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6" aria-label="Abas de configuração">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors
                ${abaAtiva === aba.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              {aba.icon}
              {aba.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      {carregandoDados ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          {abaAtiva === 'perfil' && (
            <PerfilTab
              dados={dadosUsuario}
              token={token}
              onSucesso={(msg) => { mostrarToast('sucesso', msg); carregarPerfil(); }}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'seguranca' && (
            <SegurancaTab
              token={token}
              twoFactorEnabled={dadosUsuario?.twoFactorEnabled ?? false}
              onSucesso={(msg) => mostrarToast('sucesso', msg)}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'escritorio' && (
            <EscritorioTab
              dados={dadosUsuario}
              token={token}
              onSucesso={(msg) => { mostrarToast('sucesso', msg); carregarPerfil(); }}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'white-label' && (
            <WhiteLabelTab
              token={token}
              onSucesso={(msg) => mostrarToast('sucesso', msg)}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'privacidade' && (
            <PrivacidadeTab
              token={token}
              onSucesso={(msg) => mostrarToast('sucesso', msg)}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'assinatura' && (
            <AssinaturaTab
              token={token}
              dadosUsuario={dadosUsuario}
              onSucesso={(msg) => mostrarToast('sucesso', msg)}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'integracoes' && (
            <IntegracoesTab
              token={token}
              onSucesso={(msg) => mostrarToast('sucesso', msg)}
              onErro={(msg) => mostrarToast('erro', msg)}
            />
          )}
          {abaAtiva === 'notificacoes' && (
            <NotificacoesTab token={token} />
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border
            ${toast.tipo === 'sucesso'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              : <AlertCircle  size={18} className="text-red-500 shrink-0" />
            }
            <span className="text-sm font-medium">{toast.mensagem}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab: Perfil
// =============================================================================

function PerfilTab({
  dados,
  token,
  onSucesso,
  onErro,
}: {
  dados:    UsuarioAPI | null;
  token:    string | null;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const [form, setForm] = useState<PerfilForm>({
    nome:  dados?.name  ?? '',
    email: dados?.email ?? '',
    phone: dados?.phone ?? '',
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (dados) {
      setForm({ nome: dados.name, email: dados.email, phone: dados.phone ?? '' });
    }
  }, [dados]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.nome.trim() || !form.email.trim()) {
      onErro('Nome e e-mail são obrigatórios.');
      return;
    }
    if (!validarEmail(form.email)) {
      onErro('E-mail inválido.');
      return;
    }
    if (form.phone.trim() && !validarTelefone(form.phone)) {
      onErro('Telefone inválido. Ex: (11) 91234-5678');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/v1/auth/update-profile', {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome:  form.nome.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        onErro(data.message ?? 'Erro ao atualizar perfil.');
        return;
      }

      onSucesso('Perfil atualizado com sucesso!');
    } catch {
      onErro('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dados Pessoais</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <label htmlFor="perfil-nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nome Completo
            </label>
            <input
              id="perfil-nome"
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                         focus:border-transparent transition-shadow"
              placeholder="Seu nome completo"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="perfil-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              E-mail
            </label>
            <input
              id="perfil-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                         focus:border-transparent transition-shadow"
              placeholder="seu@email.com"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="perfil-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Telefone
            </label>
            <input
              id="perfil-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: mascararTelefone(e.target.value) }))}
              maxLength={15}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                         focus:border-transparent transition-shadow sm:max-w-xs"
              placeholder="(11) 99999-0000"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm
                     font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando…' : 'Salvar Perfil'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Tab: Segurança
// =============================================================================

function SegurancaTab({
  token,
  twoFactorEnabled: twoFactorEnabledProp,
  onSucesso,
  onErro,
}: {
  token:              string | null;
  twoFactorEnabled:   boolean;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const [form, setForm] = useState<SenhaForm>({
    senhaAtual:     '',
    novaSenha:      '',
    confirmarSenha: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha,  setMostrarNovaSenha]  = useState(false);

  // ---------------------------------------------------------------------------
  // 2FA state
  // ---------------------------------------------------------------------------
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(twoFactorEnabledProp);
  const [qrCode,           setQrCode]           = useState('');
  const [secret,           setSecret]           = useState('');
  const [totpInput,        setTotpInput]        = useState('');
  const [backupCodes,      setBackupCodes]      = useState<string[]>([]);
  const [disablePassword,  setDisablePassword]  = useState('');
  const [setupStep,        setSetupStep]        = useState<'idle' | 'qr' | 'codes' | 'disabling'>('idle');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Sync initial prop (in case parent fetches after first render)
  useEffect(() => {
    setTwoFactorEnabled(twoFactorEnabledProp);
  }, [twoFactorEnabledProp]);

  // ---------------------------------------------------------------------------
  // 2FA handlers
  // ---------------------------------------------------------------------------
  async function handleSetup2FA() {
    setTwoFactorLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/setup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Falha ao iniciar setup');
      }
      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupStep('qr');
    } catch (e: unknown) {
      onErro(e instanceof Error ? e.message : 'Falha ao iniciar setup do 2FA.');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleEnable2FA() {
    setTwoFactorLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/enable', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ token: totpInput }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Código inválido');
      }
      const data = await res.json();
      setBackupCodes(data.backupCodes);
      setTwoFactorEnabled(true);
      setSetupStep('codes');
    } catch (e: unknown) {
      onErro(e instanceof Error ? e.message : 'Código inválido. Tente novamente.');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleDisable2FA() {
    setTwoFactorLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/disable', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ senha: disablePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Falha ao desativar');
      }
      setTwoFactorEnabled(false);
      setSetupStep('idle');
      setDisablePassword('');
      onSucesso('2FA desativado com sucesso.');
    } catch (e: unknown) {
      onErro(e instanceof Error ? e.message : 'Falha ao desativar o 2FA.');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.senhaAtual || !form.novaSenha || !form.confirmarSenha) {
      onErro('Todos os campos de senha são obrigatórios.');
      return;
    }

    if (form.novaSenha.length < 8) {
      onErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (form.novaSenha !== form.confirmarSenha) {
      onErro('A nova senha e a confirmação não conferem.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        onErro(data.message ?? 'Erro ao alterar senha.');
        return;
      }

      onSucesso('Senha alterada com sucesso!');
      setForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
    } catch {
      onErro('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alterar Senha */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Alterar Senha</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A nova senha deve ter pelo menos 8 caracteres.
          </p>

          <div className="space-y-4 max-w-md">
            {/* Senha Atual */}
            <div className="space-y-1.5">
              <label htmlFor="senha-atual" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Senha Atual
              </label>
              <div className="relative">
                <input
                  id="senha-atual"
                  type={mostrarSenhaAtual ? 'text' : 'password'}
                  value={form.senhaAtual}
                  onChange={(e) => setForm((f) => ({ ...f, senhaAtual: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100
                             placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                             focus:border-transparent transition-shadow"
                  placeholder="Digite sua senha atual"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhaAtual((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {mostrarSenhaAtual ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Nova Senha */}
            <div className="space-y-1.5">
              <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  id="nova-senha"
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  value={form.novaSenha}
                  onChange={(e) => setForm((f) => ({ ...f, novaSenha: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100
                             placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                             focus:border-transparent transition-shadow"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <label htmlFor="confirmar-senha" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmar Nova Senha
              </label>
              <input
                id="confirmar-senha"
                type="password"
                value={form.confirmarSenha}
                onChange={(e) => setForm((f) => ({ ...f, confirmarSenha: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                           placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                           focus:border-transparent transition-shadow"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm
                       font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {salvando ? 'Alterando…' : 'Alterar Senha'}
          </button>
        </div>
      </form>

      {/* ------------------------------------------------------------------ */}
      {/* Autenticação em dois fatores                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Autenticação em dois fatores</h2>
        </div>

        {/* idle + 2FA disabled → show activate button */}
        {setupStep === 'idle' && !twoFactorEnabled && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Adicione uma camada extra de segurança à sua conta.
            </p>
            <button
              type="button"
              onClick={handleSetup2FA}
              disabled={twoFactorLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm
                         font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                         disabled:cursor-not-allowed transition-colors"
            >
              {twoFactorLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {twoFactorLoading ? 'Aguarde…' : 'Ativar 2FA'}
            </button>
          </div>
        )}

        {/* idle + 2FA enabled → show active badge + disable button */}
        {setupStep === 'idle' && twoFactorEnabled && (
          <div className="flex items-center gap-3">
            <span className="text-sm bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded text-xs font-medium">
              Ativo
            </span>
            <button
              type="button"
              onClick={() => setSetupStep('disabling')}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 px-4 py-2
                         text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Desativar
            </button>
          </div>
        )}

        {/* qr step → show QR code + TOTP input */}
        {setupStep === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Escaneie o QR Code com seu app autenticador (Google Authenticator, Authy):
            </p>
            {qrCode && (
              <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ou insira manualmente:{' '}
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">{secret}</code>
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={totpInput}
                onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                           placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                           focus:border-transparent transition-shadow font-mono tracking-widest"
              />
              <button
                type="button"
                onClick={handleEnable2FA}
                disabled={totpInput.length !== 6 || twoFactorLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm
                           font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                           disabled:cursor-not-allowed transition-colors"
              >
                {twoFactorLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {twoFactorLoading ? 'Verificando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => { setSetupStep('idle'); setTotpInput(''); setQrCode(''); setSecret(''); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                           hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* codes step → show backup codes */}
        {setupStep === 'codes' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">2FA ativado com sucesso!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Guarde os códigos de backup em local seguro. Cada código só pode ser usado uma vez:
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {backupCodes.map((code) => (
                <span key={code} className="text-gray-800 dark:text-gray-200">{code}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSetupStep('idle')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Feito
            </button>
          </div>
        )}

        {/* disabling step → confirm with password */}
        {setupStep === 'disabling' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">Digite sua senha para desativar o 2FA:</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Sua senha atual"
                className="max-w-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                           placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                           focus:border-transparent transition-shadow"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={handleDisable2FA}
                disabled={!disablePassword || twoFactorLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-600 px-4 py-2 text-sm font-semibold
                           text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {twoFactorLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                {twoFactorLoading ? 'Desativando…' : 'Desativar'}
              </button>
              <button
                type="button"
                onClick={() => { setSetupStep('idle'); setDisablePassword(''); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                           hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Tab: Escritório
// =============================================================================

function EscritorioTab({
  dados,
  token,
  onSucesso,
  onErro,
}: {
  dados:     UsuarioAPI | null;
  token:     string | null;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const [form, setForm] = useState<EscritorioForm>({
    crc:   dados?.crc   ?? '',
    phone: dados?.phone ?? '',
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (dados) {
      setForm({ crc: dados.crc ?? '', phone: dados.phone ?? '' });
    }
  }, [dados]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.crc.trim()) {
      onErro('O CRC é obrigatório.');
      return;
    }
    if (form.phone.trim() && !validarTelefone(form.phone)) {
      onErro('Telefone inválido. Ex: (11) 3000-0000');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/v1/auth/update-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({
          crc:   form.crc.trim(),
          phone: form.phone.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        onErro(data.message ?? 'Erro ao atualizar dados do escritório.');
        return;
      }

      onSucesso('Dados do escritório atualizados com sucesso!');
    } catch {
      onErro('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dados do Escritório</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* CRC */}
          <div className="space-y-1.5">
            <label htmlFor="esc-crc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              CRC (Registro no Conselho)
            </label>
            <input
              id="esc-crc"
              type="text"
              value={form.crc}
              onChange={(e) => setForm((f) => ({ ...f, crc: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                         focus:border-transparent transition-shadow"
              placeholder="CRC-SP-123456/O-1"
            />
          </div>

          {/* Telefone do Escritório */}
          <div className="space-y-1.5">
            <label htmlFor="esc-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Telefone do Escritório
            </label>
            <input
              id="esc-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: mascararTelefone(e.target.value) }))}
              maxLength={15}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary
                         focus:border-transparent transition-shadow"
              placeholder="(11) 3000-0000"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm
                     font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando…' : 'Salvar Escritório'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Tab: White Label
// =============================================================================

interface WhiteLabelConfig {
  nomeEscritorio: string;
  cnpjEscritorio: string;
  logoUrl: string | null;
  corPrimaria: string;
  corSecundaria: string;
}

const CORES_PRESET = [
  '#2563eb', '#7c3aed', '#059669', '#dc2626', '#d97706',
  '#0891b2', '#4f46e5', '#be185d', '#1d4ed8', '#65a30d',
];

function WhiteLabelTab({
  token,
  onSucesso,
  onErro,
}: {
  token:     string | null;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const [config, setConfig] = useState<WhiteLabelConfig>({
    nomeEscritorio: '',
    cnpjEscritorio: '',
    logoUrl: null,
    corPrimaria: '#2563eb',
    corSecundaria: '#1e3a8a',
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Carregar config
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/v1/escritorio/config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConfig(data.config);
        }
      } catch { /* ignore */ } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  // Salvar configuração
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/v1/escritorio/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nomeEscritorio: config.nomeEscritorio,
          cnpjEscritorio: config.cnpjEscritorio,
          corPrimaria: config.corPrimaria,
          corSecundaria: config.corSecundaria,
        }),
      });
      const data = await res.json();
      if (!res.ok) { onErro(data.message ?? 'Erro ao salvar.'); return; }
      applyThemeCssVars(config.corPrimaria, config.corSecundaria);
      onSucesso('Configuração White Label salva!');
    } catch {
      onErro('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  // Upload de logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (file.size > 2 * 1024 * 1024) {
      onErro('O logo deve ter no máximo 2MB.');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch('/api/v1/escritorio/config/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) { onErro(data.message ?? 'Erro ao enviar logo.'); return; }
      const novaLogo = data?.config?.logoUrl || data?.logoUrl;
      if (!novaLogo) {
        console.error('Resposta inesperada:', data);
        onErro('Erro ao processar resposta do servidor.');
        return;
      }
      setConfig((c) => ({ ...c, logoUrl: novaLogo }));
      onSucesso('Logo atualizado com sucesso!');
    } catch {
      onErro('Erro ao enviar logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoverLogo = async () => {
    if (!token) return;
    setUploadingLogo(true);
    try {
      const res = await fetch('/api/v1/escritorio/config/logo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { onErro(data.message ?? 'Erro ao remover logo.'); return; }
      setConfig((c) => ({ ...c, logoUrl: null }));
      onSucesso('Logo removido com sucesso!');
    } catch {
      onErro('Erro ao remover logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSalvar} className="space-y-6">
      {/* Logo */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Logo do Escritório</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">PNG, JPEG, WebP ou SVG. Máximo 2MB.</p>

        <div className="flex items-center gap-6">
          {/* Preview */}
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon size={32} className="text-gray-300 dark:text-gray-600" />
            )}
          </div>

          {/* Upload / Remove buttons */}
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
              {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingLogo ? 'Enviando…' : 'Enviar Logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
            </label>
            {config.logoUrl && (
              <button
                type="button"
                onClick={handleRemoverLogo}
                disabled={uploadingLogo}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dados do escritório */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Informações do Escritório</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="wl-nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Escritório</label>
            <input
              id="wl-nome"
              type="text"
              value={config.nomeEscritorio ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, nomeEscritorio: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              placeholder="Meu Escritório Contábil"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wl-cnpj" className="block text-sm font-medium text-gray-700 dark:text-gray-300">CNPJ do Escritório</label>
            <input
              id="wl-cnpj"
              type="text"
              value={config.cnpjEscritorio ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, cnpjEscritorio: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              placeholder="00.000.000/0000-00"
            />
          </div>
        </div>
      </div>

      {/* Cores do tema */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cores do Tema</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Personalize as cores da plataforma para o seu escritório.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Cor Primária */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cor Primária</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.corPrimaria ?? '#000000'}
                onChange={(e) => setConfig((c) => ({ ...c, corPrimaria: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={config.corPrimaria ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, corPrimaria: e.target.value }))}
                className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CORES_PRESET.map((cor) => (
                <button
                  key={`p-${cor}`}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, corPrimaria: cor }))}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${config.corPrimaria === cor ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>

          {/* Cor Secundária */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cor Secundária</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.corSecundaria ?? '#000000'}
                onChange={(e) => setConfig((c) => ({ ...c, corSecundaria: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={config.corSecundaria ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, corSecundaria: e.target.value }))}
                className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Preview do tema:</p>
          <div className="flex gap-3">
            <div className="h-10 w-32 rounded-lg flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: config.corPrimaria }}>
              Primária
            </div>
            <div className="h-10 w-32 rounded-lg flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: config.corSecundaria }}>
              Secundária
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando…' : 'Salvar White Label'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Tab: Privacidade (LGPD)
// =============================================================================

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  LOGIN:            { label: 'Login',                       icon: <LogIn      size={14} /> },
  LOGOUT:           { label: 'Logout',                      icon: <LogOutIcon size={14} /> },
  DOWNLOAD:         { label: 'Download de Documento',       icon: <Download   size={14} /> },
  VIEW:             { label: 'Visualização de Documento',   icon: <FileText   size={14} /> },
  UPLOAD_BATCH:     { label: 'Upload em Lote',              icon: <FileText   size={14} /> },
  STATE_CHANGE:     { label: 'Alteração de Estado',         icon: <Activity   size={14} /> },
  CONSENT_ACCEPTED: { label: 'Consentimento LGPD Aceito',   icon: <ShieldCheck size={14} /> },
  ACCOUNT_DELETED:  { label: 'Conta Excluída',              icon: <UserX      size={14} /> },
  LGPD_EXPORT:      { label: 'Exportação de Dados (LGPD)',  icon: <Download   size={14} /> },
  LGPD_ANONYMIZE:   { label: 'Anonimização (LGPD)',         icon: <UserX      size={14} /> },
};

interface AuditLogEntry {
  id:           string;
  actionType:   string;
  resourceType: string;
  timestamp:    string;
  ipAddress:    string;
  detailsJson:  Record<string, unknown>;
}

interface AuditPagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

function PrivacidadeTab({
  token,
  onSucesso,
  onErro,
}: {
  token:     string | null;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const [logs, setLogs]             = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<AuditPagination | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo]                     = useState(false);
  const [textoConfirmacao, setTextoConfirmacao]        = useState('');

  // Carregar audit log
  const carregarLogs = useCallback(async (page: number) => {
    if (!token) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/v1/auth/audit-log?page=${page}&limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch {
      onErro('Não foi possível carregar os logs de auditoria.');
    } finally {
      setCarregando(false);
    }
  }, [token, onErro]);

  useEffect(() => {
    carregarLogs(paginaAtual);
  }, [paginaAtual, carregarLogs]);

  // Exclusão de conta
  const handleExcluirConta = async () => {
    if (textoConfirmacao !== 'EXCLUIR MINHA CONTA') {
      onErro('Digite exatamente "EXCLUIR MINHA CONTA" para confirmar.');
      return;
    }
    if (!token) return;

    setExcluindo(true);
    try {
      const res = await fetch('/api/v1/auth/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onErro(data.message ?? 'Erro ao excluir conta.');
        return;
      }

      // Limpar auth e redirecionar
      onSucesso('Conta excluída com sucesso. Redirecionando...');
      setTimeout(() => {
        document.cookie = 'contabilidade_jwt=; path=/; max-age=0';
        localStorage.removeItem('contabilidade_jwt');
        window.location.href = '/';
      }, 2000);
    } catch {
      onErro('Erro de conexão. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Audit Log */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico de Acessos</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Registro de todas as ações realizadas na sua conta, conforme a Lei Geral de Proteção de Dados (LGPD).
        </p>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">Nenhum registro de atividade encontrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Ação</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Data/Hora</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {logs.map((log) => {
                    const info = ACTION_LABELS[log.actionType] ?? { label: log.actionType, icon: <Activity size={14} /> };
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-gray-400 dark:text-gray-500">{info.icon}</span>
                            {info.label}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{log.ipAddress}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                    disabled={paginaAtual <= 1}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPaginaAtual((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={paginaAtual >= pagination.totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Exclusão de Conta */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900/40 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-red-500" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">Excluir Conta</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ao excluir sua conta, seus dados pessoais serão anonimizados e os documentos
          fiscais serão removidos do armazenamento. Esta ação é <strong>irreversível</strong>.
        </p>

        {!confirmandoExclusao ? (
          <button
            onClick={() => setConfirmandoExclusao(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 px-4 py-2
                       text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} />
            Solicitar Exclusão da Conta
          </button>
        ) : (
          <div className="space-y-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-4 border border-red-100 dark:border-red-900/40">
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
              Para confirmar, digite <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-xs">EXCLUIR MINHA CONTA</code> abaixo:
            </p>
            <input
              type="text"
              value={textoConfirmacao}
              onChange={(e) => setTextoConfirmacao(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                         placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500
                         focus:border-transparent transition-shadow"
              placeholder="EXCLUIR MINHA CONTA"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                onClick={handleExcluirConta}
                disabled={excluindo || textoConfirmacao !== 'EXCLUIR MINHA CONTA'}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm
                           font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50
                           disabled:cursor-not-allowed transition-colors"
              >
                {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {excluindo ? 'Excluindo…' : 'Confirmar Exclusão'}
              </button>
              <button
                onClick={() => { setConfirmandoExclusao(false); setTextoConfirmacao(''); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                           hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Tab: Assinatura
// =============================================================================

// =============================================================================
// Tab: Assinatura (SaaS Billing)
// =============================================================================

interface AssinaturaInfo {
  id: string;
  planoNome: string;
  precoPlano: number;
  valorMensal: number;
  status: string;
  diaVencimento: number;
  dataInicio: string;
  dataRenovacao: string;
  billingType: string;
  observacoes: string | null;
  asaasSubscriptionId: string | null;
}

interface CobrancaInfo {
  id: string;
  valor: number;
  vencimento: string;
  mesReferencia: string;
  status: string;
  asaasBoletoUrl: string | null;
  asaasInvoiceUrl: string | null;
  asaasPixPayload: string | null;
  asaasBarcode: string | null;
}

function AssinaturaTab({
  token,
  dadosUsuario,
  onSucesso,
  onErro,
}: {
  token:        string | null | undefined;
  dadosUsuario?: UsuarioAPI | null;
  onSucesso:    (msg: string) => void;
  onErro:       (msg: string) => void;
}) {
  const [assinatura, setAssinatura] = useState<AssinaturaInfo | null>(null);
  const [cobrancas, setCobrancas] = useState<CobrancaInfo[]>([]);
  const [hasAssinatura, setHasAssinatura] = useState<boolean>(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  // Pix/Boleto copy states
  const [copiadoPixId, setCopiadoPixId] = useState<string | null>(null);
  const [copiadoBarcodeId, setCopiadoBarcodeId] = useState<string | null>(null);

  // Card form states
  const [showCardForm, setShowCardForm] = useState(false);
  const [salvandoCartao, setSalvandoCartao] = useState(false);
  const [cartaoErro, setCartaoErro] = useState<string | null>(null);

  // Credit card form inputs
  const [holderName, setHolderName] = useState('');
  const [number, setNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');
  
  // Titular inputs (prefilled with user details)
  const [name, setName] = useState(dadosUsuario?.name ?? '');
  const [email, setEmail] = useState(dadosUsuario?.email ?? '');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [phone, setPhone] = useState(dadosUsuario?.phone ?? '');

  // Sync with dadosUsuario if they load late
  useEffect(() => {
    if (dadosUsuario) {
      if (!name) setName(dadosUsuario.name);
      if (!email) setEmail(dadosUsuario.email);
      if (!phone && dadosUsuario.phone) setPhone(dadosUsuario.phone);
    }
  }, [dadosUsuario]);

  const carregarAssinatura = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) setCarregando(true);
    try {
      const res = await fetch('/api/v1/minha-assinatura', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHasAssinatura(data.hasAssinatura ?? false);
      if (data.hasAssinatura) {
        setAssinatura(data.assinatura);
        setCobrancas(data.cobrancas || []);
      }
    } catch {
      onErro('Não foi possível carregar as informações do faturamento SaaS.');
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [token, onErro]);

  useEffect(() => {
    carregarAssinatura();
  }, [carregarAssinatura]);

  const copyToClipboard = (text: string, cobrancaId: string, type: 'pix' | 'barcode') => {
    navigator.clipboard.writeText(text);
    if (type === 'pix') {
      setCopiadoPixId(cobrancaId);
      setTimeout(() => setCopiadoPixId(null), 2000);
    } else {
      setCopiadoBarcodeId(cobrancaId);
      setTimeout(() => setCopiadoBarcodeId(null), 2000);
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSalvandoCartao(true);
    setCartaoErro(null);

    try {
      const res = await fetch('/api/v1/minha-assinatura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          holderName,
          number,
          expiryMonth,
          expiryYear,
          ccv,
          name,
          email,
          cpfCnpj,
          postalCode,
          addressNumber,
          phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCartaoErro(data.message ?? 'Falha ao salvar dados do cartão.');
        return;
      }

      onSucesso('Cartão de crédito configurado com sucesso para pagamentos recorrentes!');
      setShowCardForm(false);
      
      // Limpa formulário
      setHolderName('');
      setNumber('');
      setExpiryMonth('');
      setExpiryYear('');
      setCcv('');
      setCpfCnpj('');
      setPostalCode('');
      setAddressNumber('');
      
      // Recarrega assinatura
      await carregarAssinatura();
    } catch {
      setCartaoErro('Erro de rede ao salvar cartão. Verifique sua conexão.');
    } finally {
      setSalvandoCartao(false);
    }
  };

  const handleSync = async () => {
    setAtualizando(true);
    try {
      await carregarAssinatura(true);
      onSucesso('Dados de faturamento atualizados!');
    } catch {
      onErro('Erro ao sincronizar.');
    } finally {
      setAtualizando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!hasAssinatura || !assinatura) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center space-y-4">
        <AlertCircle size={40} className="mx-auto text-amber-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Faturamento SaaS Não Configurado</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Seu escritório não possui uma assinatura parametrizada na plataforma FiscoHub. 
          Entre em contato com nossa equipe administrativa para cadastrar seu plano e habilitar o faturamento.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const labels: Record<string, { text: string, classes: string }> = {
      TRIAL: { text: 'Período Trial', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      ATIVO: { text: 'Ativo', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
      INADIMPLENTE: { text: 'Inadimplente', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
      SUSPENSO: { text: 'Suspenso', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      CANCELADO: { text: 'Cancelado', classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' },
    };
    const item = labels[status] ?? { text: status, classes: 'bg-gray-100 text-gray-800' };
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.classes}`}>{item.text}</span>;
  };

  const formatBillingType = (type: string) => {
    if (assinatura.valorMensal === 0) return 'Isento';
    switch (type) {
      case 'CREDIT_CARD': return 'Cartão de Crédito';
      case 'BOLETO': return 'Boleto Bancário';
      case 'PIX': return 'PIX';
      default: return type === 'UNDEFINED' ? 'Não Definida' : type;
    }
  };

  const totalPendente = cobrancas.filter(c => c.status === 'PENDENTE' || c.status === 'VENCIDO').length;

  return (
    <div className="space-y-6">
      
      {/* Detalhes do Plano */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Assinatura do Escritório</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSync} 
              disabled={atualizando}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
              title="Atualizar dados de faturamento"
            >
              <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} />
            </button>
            {getStatusBadge(assinatura.status)}
          </div>
        </div>

        {/* Trial message */}
        {assinatura.status === 'TRIAL' && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">Período de Demonstração (Trial)</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Você tem 7 dias grátis a contar da data de início ({new Date(assinatura.dataInicio).toLocaleDateString('pt-BR')}) para usar a plataforma livremente. 
              Após 7 dias, caso não haja compensação de pagamento da assinatura, o acesso será temporariamente bloqueado.
            </p>
          </div>
        )}

        {/* Inadimplente alert */}
        {(assinatura.status === 'INADIMPLENTE' || totalPendente > 0) && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 rounded-xl p-4 text-sm text-red-800 dark:text-red-300 space-y-1">
            <p className="font-semibold">Atenção: Assinatura com faturas pendentes</p>
            <p className="text-xs text-red-700 dark:text-red-400">
              Identificamos faturas pendentes de pagamento. Regularize os débitos abaixo via PIX ou Boleto para evitar bloqueio automático ou reestabelecer o acesso dos seus contadores e clientes.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Plano Ativo</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{assinatura.planoNome}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Valor da Mensalidade</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {assinatura.valorMensal === 0 ? 'Isento (Permanente)' : `R$ ${assinatura.valorMensal.toFixed(2)}`}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Próximo Vencimento</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {assinatura.valorMensal === 0 ? '-' : new Date(assinatura.dataRenovacao).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="text-sm border-t border-gray-100 dark:border-gray-800 pt-4 flex justify-between items-center text-gray-600 dark:text-gray-400">
          <span>Forma de Cobrança Padrão: <strong>{formatBillingType(assinatura.billingType)}</strong></span>
          {assinatura.diaVencimento && (
            <span>Dia do Vencimento: <strong>Todo dia {assinatura.diaVencimento}</strong></span>
          )}
        </div>
      </div>

      {/* Cartão de Crédito Recorrente */}
      {assinatura.valorMensal > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-violet-500" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Pagamento Recorrente via Cartão de Crédito</h3>
            </div>
            {assinatura.billingType === 'CREDIT_CARD' && (
              <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold px-2.5 py-1 rounded-full">
                Ativo no Cartão
              </span>
            )}
          </div>

          {assinatura.billingType === 'CREDIT_CARD' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                As cobranças mensais da sua assinatura SaaS FiscoHub são debitadas automaticamente em seu cartão de crédito cadastrado todo dia {assinatura.diaVencimento}.
              </p>
              {!showCardForm ? (
                <button
                  onClick={() => setShowCardForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Alterar Cartão de Crédito Cadastrado
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Habilite o débito automático no cartão de crédito e evite interrupções no acesso do seu escritório por esquecimento no pagamento do boleto ou Pix.
              </p>
              {!showCardForm ? (
                <button
                  onClick={() => setShowCardForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-95 transition-all"
                >
                  Cadastrar Cartão de Crédito
                </button>
              ) : null}
            </div>
          )}

          {/* Form Cartão de Crédito */}
          {showCardForm && (
            <form onSubmit={handleSaveCard} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4 bg-gray-50/50 dark:bg-gray-800/20 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Cadastrar Novo Cartão</span>
                <button
                  type="button"
                  onClick={() => setShowCardForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-semibold"
                >
                  Cancelar
                </button>
              </div>

              {/* Grid dos campos do Cartão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nome impresso no cartão</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: JOAO S SILVA"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-shadow"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Número do cartão</label>
                  <input
                    type="text"
                    required
                    placeholder="0000 0000 0000 0000"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-shadow"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center block">Mês Exp.</label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      placeholder="MM"
                      value={expiryMonth}
                      onChange={(e) => setExpiryMonth(e.target.value)}
                      className="w-full text-sm text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center block">Ano Exp.</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      placeholder="AAAA"
                      value={expiryYear}
                      onChange={(e) => setExpiryYear(e.target.value)}
                      className="w-full text-sm text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center block">CVV</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      placeholder="123"
                      value={ccv}
                      onChange={(e) => setCcv(e.target.value)}
                      className="w-full text-sm text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Dados de Faturamento do Titular</h4>
              </div>

              {/* Grid dos campos do Titular */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">CPF ou CNPJ</label>
                  <input
                    type="text"
                    required
                    placeholder="Apenas números"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Telefone com DDD</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 11999998888"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">CEP</label>
                  <input
                    type="text"
                    required
                    placeholder="Apenas números"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Número do endereço</label>
                  <input
                    type="text"
                    required
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {cartaoErro && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 border border-red-100 dark:border-red-900/40">
                  {cartaoErro}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={salvandoCartao}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-semibold transition-all shadow-sm"
                >
                  {salvandoCartao ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando Cartão...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Salvar Cartão de Crédito
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCardForm(false)}
                  className="border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Histórico de Faturas */}
      {assinatura.valorMensal > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Histórico de Faturas</h3>
          </div>

          {cobrancas.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
              Nenhuma fatura emitida encontrada.
            </p>
          ) : (
            <div className="space-y-4">
              {cobrancas.map((cob) => {
                const isPendente = cob.status === 'PENDENTE' || cob.status === 'VENCIDO';
                
                const getStatusColor = (st: string) => {
                  switch (st) {
                    case 'PAGO': return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
                    case 'PENDENTE': return 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
                    case 'VENCIDO': return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
                    case 'CANCELADO': return 'text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
                    default: return 'text-gray-700 bg-gray-100';
                  }
                };

                return (
                  <div key={cob.id} className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 bg-white dark:bg-gray-900/40">
                    
                    {/* Header da Fatura */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                          Referência: {cob.mesReferencia}
                        </span>
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          R$ {cob.valor.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Vence em: {new Date(cob.vencimento).toLocaleDateString('pt-BR')}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(cob.status)}`}>
                          {cob.status}
                        </span>
                      </div>
                    </div>

                    {/* Ações de Pagamento para Faturas Pendentes/Vencidas */}
                    {isPendente && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Opções de Pagamento (Liberação Imediata)
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Pix Payload */}
                          {cob.asaasPixPayload && (
                            <div className="bg-violet-50/50 dark:bg-violet-900/5 rounded-lg p-3 border border-violet-100/50 dark:border-violet-900/30 flex flex-col justify-between space-y-2">
                              <div>
                                <span className="font-bold text-xs text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                  <QrCode size={13} className="text-violet-600" /> PIX
                                </span>
                                <span className="text-[10px] text-gray-400 block mt-0.5">Liberação automática em 2 minutos</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(cob.asaasPixPayload!, cob.id, 'pix')}
                                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                                  copiadoPixId === cob.id 
                                    ? 'bg-green-600 text-white border-green-600' 
                                    : 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                                }`}
                              >
                                {copiadoPixId === cob.id ? (
                                  <>
                                    <Check size={12} />
                                    PIX Copiado!
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    Copiar PIX Copia e Cola
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* Boleto Link & Barcode */}
                          {cob.asaasBoletoUrl && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/5 rounded-lg p-3 border border-blue-100/50 dark:border-blue-900/30 flex flex-col justify-between space-y-2">
                              <div>
                                <span className="font-bold text-xs text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                  <FileText size={13} className="text-blue-600" /> Boleto Bancário
                                </span>
                                <span className="text-[10px] text-gray-400 block mt-0.5">Compensação em até 1 dia útil</span>
                              </div>
                              <div className="space-y-1.5">
                                <a
                                  href={cob.asaasBoletoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all text-center"
                                >
                                  <ExternalLink size={12} />
                                  Visualizar Boleto
                                </a>
                                {cob.asaasBarcode && (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(cob.asaasBarcode!, cob.id, 'barcode')}
                                    className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                                      copiadoBarcodeId === cob.id
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    {copiadoBarcodeId === cob.id ? 'Linha Digitável Copiada!' : 'Copiar Código de Barras'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab: Integrações
// =============================================================================

function IntegracoesTab({
  token,
  onSucesso,
  onErro,
}: {
  token:    string | null;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  // Asaas
  const [asaasKey,        setAsaasKey]        = useState('');
  const [asaasConectado,  setAsaasConectado]  = useState(false);
  const [asaasEmpresa,    setAsaasEmpresa]    = useState<string | null>(null);
  const [mostrarAsaasKey, setMostrarAsaasKey] = useState(false);
  const [salvandoAsaas,   setSalvandoAsaas]   = useState(false);

  // Cora
  const [coraClientId,   setCoraClientId]   = useState('');
  const [coraCertPem,    setCoraCertPem]    = useState('');
  const [coraPrivKeyPem, setCoraPrivKeyPem] = useState('');
  const [coraConectada,  setCoraConectada]  = useState(false);
  const [salvandoCora,   setSalvandoCora]   = useState(false);

  const [carregando, setCarregando] = useState(true);

  // integração ativa: 'asaas' | 'cora' | null — apenas uma pode estar ativa
  const integracaoAtiva: 'asaas' | 'cora' | null =
    asaasConectado ? 'asaas' : coraConectada ? 'cora' : null;

  // ---------------------------------------------------------------------------
  // Carregar estado atual
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/escritorio/integracao', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { asaas?: { configurado: boolean }; cora?: { configurado: boolean; clientId: string | null } } | null) => {
        if (d?.asaas?.configurado) setAsaasConectado(true);
        if (d?.cora?.configurado) {
          setCoraConectada(true);
          setCoraClientId(d.cora.clientId ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [token]);

  // ---------------------------------------------------------------------------
  // Salvar integração Asaas (o backend zera a Cora automaticamente)
  // ---------------------------------------------------------------------------
  const salvarAsaas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || salvandoAsaas) return;
    setSalvandoAsaas(true);
    try {
      const res = await fetch('/api/v1/escritorio/integracao', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ asaasApiKey: asaasKey }),
      });
      const data = await res.json() as { ok?: boolean; configurado?: boolean; nomeEmpresaAsaas?: string; message?: string };
      if (!res.ok) { onErro(data.message ?? 'Erro ao conectar com Asaas.'); return; }
      setAsaasConectado(data.configurado ?? false);
      setAsaasEmpresa(data.nomeEmpresaAsaas ?? null);
      setAsaasKey('');
      // Cora foi zerada no backend — reflete no estado local
      setCoraConectada(false);
      setCoraClientId('');
      onSucesso('Asaas conectado com sucesso!');
    } catch {
      onErro('Erro ao conectar com Asaas.');
    } finally {
      setSalvandoAsaas(false);
    }
  };

  const removerAsaas = async () => {
    if (!token || salvandoAsaas) return;
    setSalvandoAsaas(true);
    try {
      const res = await fetch('/api/v1/escritorio/integracao', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ asaasApiKey: '' }),
      });
      if (!res.ok) { onErro('Erro ao remover chave Asaas.'); return; }
      setAsaasConectado(false);
      setAsaasEmpresa(null);
      onSucesso('Integração Asaas removida.');
    } catch {
      onErro('Erro ao remover chave Asaas.');
    } finally {
      setSalvandoAsaas(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Salvar integração Cora (o backend zera o Asaas automaticamente)
  // ---------------------------------------------------------------------------
  const salvarCora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || salvandoCora) return;
    if (!coraClientId.trim() || !coraCertPem.trim() || !coraPrivKeyPem.trim()) {
      onErro('Preencha todos os campos da Cora.');
      return;
    }
    setSalvandoCora(true);
    try {
      const res = await fetch('/api/v1/escritorio/integracao/cora', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ coraClientId, coraCertificatePem: coraCertPem, coraPrivateKeyPem: coraPrivKeyPem }),
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok) { onErro(data.message ?? 'Erro ao salvar configuração Cora.'); return; }
      setCoraConectada(true);
      setCoraCertPem('');
      setCoraPrivKeyPem('');
      // Asaas foi zerado no backend — reflete no estado local
      setAsaasConectado(false);
      setAsaasEmpresa(null);
      onSucesso('Cora configurada com sucesso!');
    } catch {
      onErro('Erro ao salvar configuração Cora.');
    } finally {
      setSalvandoCora(false);
    }
  };

  const removerCora = async () => {
    if (!token || salvandoCora) return;
    setSalvandoCora(true);
    try {
      const res = await fetch('/api/v1/escritorio/integracao/cora', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ coraClientId: '', coraCertificatePem: '', coraPrivateKeyPem: '' }),
      });
      if (!res.ok) { onErro('Erro ao remover integração Cora.'); return; }
      setCoraClientId('');
      setCoraConectada(false);
      onSucesso('Integração Cora removida.');
    } catch {
      onErro('Erro ao remover integração Cora.');
    } finally {
      setSalvandoCora(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* Aviso de exclusividade */}
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
        <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          <strong>Apenas uma integração de boleto pode estar ativa por vez.</strong>{' '}
          Ao conectar Asaas ou Cora, a outra é removida automaticamente.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 py-10 justify-center text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* ── Asaas ──────────────────────────────────────────────────────── */}
          <div className={`bg-white dark:bg-gray-900 rounded-xl border p-6 space-y-5 transition-opacity ${
            integracaoAtiva === 'cora' ? 'border-gray-200 dark:border-gray-700 opacity-50 pointer-events-none' : 'border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-primary dark:text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Asaas</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cobrança automatizada e gestão financeira</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                asaasConectado
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : integracaoAtiva === 'cora'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${asaasConectado ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {asaasConectado ? 'Conectado' : integracaoAtiva === 'cora' ? 'Indisponível' : 'Não configurado'}
              </span>
            </div>

            {asaasConectado ? (
              <div className="space-y-3">
                {asaasEmpresa && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    Conta conectada: <span className="font-medium text-gray-900 dark:text-gray-100">{asaasEmpresa}</span>
                  </div>
                )}
                <button
                  onClick={removerAsaas}
                  disabled={salvandoAsaas}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5
                             text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  {salvandoAsaas ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Remover integração
                </button>
              </div>
            ) : (
              <form onSubmit={salvarAsaas} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Chave de API</label>
                  <div className="relative">
                    <input
                      type={mostrarAsaasKey ? 'text' : 'password'}
                      value={asaasKey}
                      onChange={(e) => setAsaasKey(e.target.value)}
                      placeholder="$aact_…"
                      autoComplete="off"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
                                 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                                 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarAsaasKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {mostrarAsaasKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Encontre sua chave em <strong>Asaas → Integrações → Chave de API</strong>.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={salvandoAsaas || !asaasKey.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white
                             hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {salvandoAsaas ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  {salvandoAsaas ? 'Conectando…' : 'Conectar'}
                </button>
              </form>
            )}
          </div>

          {/* ── Cora ───────────────────────────────────────────────────────── */}
          <div className={`bg-white dark:bg-gray-900 rounded-xl border p-6 space-y-5 transition-opacity ${
            integracaoAtiva === 'asaas' ? 'border-gray-200 dark:border-gray-700 opacity-50 pointer-events-none' : 'border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-primary dark:text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cora</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Conta digital para contadores — boletos e Pix</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                coraConectada
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : integracaoAtiva === 'asaas'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${coraConectada ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {coraConectada ? 'Configurada' : integracaoAtiva === 'asaas' ? 'Indisponível' : 'Não configurada'}
              </span>
            </div>

            {coraConectada ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  Client ID: <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{coraClientId}</code>
                </div>
                <button
                  onClick={removerCora}
                  disabled={salvandoCora}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5
                             text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  {salvandoCora ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Remover integração
                </button>
              </div>
            ) : (
              <form onSubmit={salvarCora} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Client ID</label>
                  <input
                    type="text"
                    value={coraClientId}
                    onChange={(e) => setCoraClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
                               px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                               focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Certificado mTLS (PEM)</label>
                  <textarea
                    value={coraCertPem}
                    onChange={(e) => setCoraCertPem(e.target.value)}
                    rows={5}
                    placeholder={"-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
                               px-3 py-2 text-xs font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                               focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Chave Privada (PEM)</label>
                  <textarea
                    value={coraPrivKeyPem}
                    onChange={(e) => setCoraPrivKeyPem(e.target.value)}
                    rows={5}
                    placeholder={"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
                               px-3 py-2 text-xs font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                               focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-y"
                  />
                </div>
                <button
                  type="submit"
                  disabled={salvandoCora || !coraClientId.trim() || !coraCertPem.trim() || !coraPrivKeyPem.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white
                             hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {salvandoCora ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  {salvandoCora ? 'Salvando…' : 'Salvar configuração'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Tab: Notificações
// =============================================================================

function NotificacoesTab({ token }: { token: string | null }) {
  const [notifEmailNovoDoc, setNotifEmailNovoDoc] = useState<boolean | null>(null);
  const [carregando, setCarregando]               = useState(true);
  const [salvando, setSalvando]                   = useState(false);
  const [toastLocal, setToastLocal]               = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/auth/preferencias-notificacao', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setNotifEmailNovoDoc(d.notifEmailNovoDoc ?? true))
      .catch(() => setNotifEmailNovoDoc(true))
      .finally(() => setCarregando(false));
  }, [token]);

  const alternar = async (novoValor: boolean) => {
    if (!token || salvando) return;
    setSalvando(true);
    setNotifEmailNovoDoc(novoValor);
    try {
      const res = await fetch('/api/v1/auth/preferencias-notificacao', {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notifEmailNovoDoc: novoValor }),
      });
      if (!res.ok) throw new Error();
      setToastLocal({ tipo: 'sucesso', msg: 'Preferência salva.' });
    } catch {
      setNotifEmailNovoDoc(!novoValor);
      setToastLocal({ tipo: 'erro', msg: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setSalvando(false);
      setTimeout(() => setToastLocal(null), 3000);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notificações por e-mail</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Escolha quais eventos geram um e-mail para você.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Cliente enviou um documento
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Receber e-mail quando um cliente fizer upload de arquivo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifEmailNovoDoc ?? true}
            aria-label="Receber e-mail quando cliente enviar documento"
            disabled={salvando}
            onClick={() => alternar(!(notifEmailNovoDoc ?? true))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50
              ${(notifEmailNovoDoc ?? true) ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                ${(notifEmailNovoDoc ?? true) ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>

      {toastLocal && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
          ${toastLocal.tipo === 'sucesso'
            ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
          }`}>
          {toastLocal.msg}
        </div>
      )}
    </div>
  );
}

