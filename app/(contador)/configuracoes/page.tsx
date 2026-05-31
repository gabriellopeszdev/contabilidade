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
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { validarEmail, validarTelefone, mascararTelefone } from '../../../src/utils/validators';

// =============================================================================
// Tipos
// =============================================================================

type Aba = 'perfil' | 'seguranca' | 'escritorio' | 'white-label' | 'privacidade';

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
  { id: 'perfil',      label: 'Perfil',      icon: <User        size={18} /> },
  { id: 'seguranca',   label: 'Segurança',   icon: <Shield      size={18} /> },
  { id: 'escritorio',  label: 'Escritório',  icon: <Building2   size={18} /> },
  { id: 'white-label', label: 'White Label', icon: <Palette     size={18} /> },
  { id: 'privacidade', label: 'Privacidade', icon: <ShieldCheck size={18} /> },
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
      // Aplicar tema dinamicamente
      document.documentElement.style.setProperty('--color-brand', config.corPrimaria);
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
