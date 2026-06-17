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

interface PlanInfo {
  planoNome:        string;
  limiteClientes:   number;
  limiteDocumentos: number;
  features:         string[];
  status:           string;
  isRestricted:     boolean;
}

const STATUS_LABELS: Record<string, { label: string; cor: string }> = {
  TRIAL:        { label: 'Trial',        cor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  ATIVO:        { label: 'Ativo',        cor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  INADIMPLENTE: { label: 'Inadimplente', cor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  SUSPENSO:     { label: 'Suspenso',     cor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
  CANCELADO:    { label: 'Cancelado',    cor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  SEM_PLANO:    { label: 'Sem plano',    cor: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
};

const FEATURE_LABELS: Record<string, string> = {
  chat:                  'Chat com clientes',
  calendario:            'Calendário de obrigações',
  financeiro:            'Módulo financeiro',
  assinatura_eletronica: 'Assinatura eletrônica',
  relatorios:            'Relatórios avançados',
  equipe:                'Gestão de equipe',
  integracao_cora:       'Integração Cora',
  ia:                    'Assistente IA',
};

function AssinaturaTab({
  token,
  onSucesso,
  onErro,
}: {
  token:     string | null | undefined;
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const [plano, setPlano]               = useState<PlanInfo | null>(null);
  const [carregando, setCarregando]     = useState(true);
  const [confirmando, setConfirmando]   = useState(false);
  const [textoConfirm, setTextoConfirm] = useState('');
  const [cancelando, setCancelando]     = useState(false);

  const carregarPlano = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const res = await fetch('/api/v1/plano/atual', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlano(data.plan);
    } catch {
      onErro('Não foi possível carregar as informações do plano.');
    } finally {
      setCarregando(false);
    }
  }, [token, onErro]);

  useEffect(() => { carregarPlano(); }, [carregarPlano]);

  const handleCancelar = async () => {
    if (!token) return;
    setCancelando(true);
    try {
      const res = await fetch('/api/v1/plano/cancelar', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { onErro(data.message ?? 'Erro ao cancelar assinatura.'); return; }
      onSucesso('Assinatura cancelada. Seus dados permanecem no plano gratuito.');
      setConfirmando(false);
      setTextoConfirm('');
      carregarPlano();
    } catch {
      onErro('Erro ao cancelar assinatura.');
    } finally {
      setCancelando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const statusInfo   = plano ? (STATUS_LABELS[plano.status] ?? STATUS_LABELS['SEM_PLANO']) : STATUS_LABELS['SEM_PLANO'];
  const podeCancelar = plano && !plano.isRestricted && plano.status !== 'SEM_PLANO' && plano.status !== 'CANCELADO';

  return (
    <div className="space-y-6">

      {/* Plano atual */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Plano Atual</h2>
          </div>
          {plano && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.cor}`}>
              {statusInfo.label}
            </span>
          )}
        </div>

        {!plano || plano.status === 'SEM_PLANO' ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Você não possui uma assinatura ativa.</p>
            <a
              href="/cadastro"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Ver planos disponíveis
            </a>
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plano.planoNome}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Clientes</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {plano.limiteClientes === -1 ? 'Ilimitado' : plano.limiteClientes}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Documentos</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {plano.limiteDocumentos === -1 ? 'Ilimitado' : plano.limiteDocumentos.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recursos incluídos</p>
              <ul className="space-y-2">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                  const incluso = plano.features.includes(key);
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      {incluso
                        ? <Check size={15} className="text-emerald-500 shrink-0" />
                        : <Lock  size={15} className="text-gray-300 dark:text-gray-600 shrink-0" />
                      }
                      <span className={incluso ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Cancelamento */}
      {podeCancelar && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900/40 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">Cancelar Assinatura</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ao cancelar, você perde acesso aos recursos do plano <strong>{plano?.planoNome}</strong> imediatamente.
            Seus dados permanecem disponíveis no plano gratuito (5 clientes, 100 documentos).
          </p>

          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 px-4 py-2
                         text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <XCircle size={14} />
              Cancelar Assinatura
            </button>
          ) : (
            <div className="space-y-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-4 border border-red-100 dark:border-red-900/40">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                Para confirmar, digite{' '}
                <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-xs">CANCELAR ASSINATURA</code>{' '}
                abaixo:
              </p>
              <input
                type="text"
                value={textoConfirm}
                onChange={(e) => setTextoConfirm(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 px-3 py-2
                           text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                           focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                placeholder="CANCELAR ASSINATURA"
                autoComplete="off"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCancelar}
                  disabled={cancelando || textoConfirm !== 'CANCELAR ASSINATURA'}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white
                             shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cancelando ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  {cancelando ? 'Cancelando…' : 'Confirmar Cancelamento'}
                </button>
                <button
                  onClick={() => { setConfirmando(false); setTextoConfirm(''); }}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium
                             text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {plano?.status === 'CANCELADO' && (
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/40 p-5 space-y-3">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            Sua assinatura foi cancelada. Para reativar, contrate um novo plano.
          </p>
          <a
            href="/cadastro"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Ver planos disponíveis
          </a>
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
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-blue-600 dark:text-blue-400" />
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
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-violet-600 dark:text-violet-400" />
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

