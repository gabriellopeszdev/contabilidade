'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Webhook,
  KeyRound,
  ShieldCheck,
  Copy,
  CheckCheck,
  Info,
  Zap,
  Database,
  Bot,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Smartphone,
  Lock,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { IA_PROVIDERS, type IaProvider } from '../../../src/utils/aiProviders';

// =============================================================================
// Componentes auxiliares
// =============================================================================

function SectionCard({ title, icon: Icon, children }: {
  title:    string;
  icon:     React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <div className="p-1.5 rounded-lg bg-violet-600/15">
          <Icon size={16} className="text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function ConfigRow({ label, value, mono, badge }: {
  label:  string;
  value:  string;
  mono?:  boolean;
  badge?: { text: string; cor: 'green' | 'amber' | 'slate' };
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  const badgeCores: Record<string, string> = {
    green: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
    amber: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
    slate: 'text-slate-400 bg-slate-800/60 border-slate-700/40',
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs text-slate-400 shrink-0 w-44">{label}</span>
        <span className={`text-xs truncate ${mono ? 'font-mono text-slate-300' : 'text-slate-200'}`}>
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] font-medium border px-1.5 py-0.5 rounded-full shrink-0 ${badgeCores[badge.cor]}`}>
            {badge.text}
          </span>
        )}
      </div>
      <button
        onClick={copiar}
        className="ml-3 p-1.5 rounded text-slate-600 hover:text-slate-300 transition-colors shrink-0"
        title="Copiar"
      >
        {copiado ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

// =============================================================================
// Página
// =============================================================================

export default function AdminConfigPage() {
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const webhookUrl  = `${appUrl}/api/v1/webhooks/asaas`;
  const asaasEnv    = process.env.NEXT_PUBLIC_ASAAS_ENV ?? 'sandbox';

  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  const mostrarToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configurações globais do sistema. Variáveis de ambiente são definidas no arquivo <code className="text-violet-300 text-[11px]">.env</code>.
        </p>
      </div>

      {/* Autenticação em 2 Fatores */}
      <TwoFactorSection onSucesso={(m) => mostrarToast('sucesso', m)} onErro={(m) => mostrarToast('erro', m)} />

      {/* Integração Asaas */}
      <SectionCard title="Integração Asaas" icon={Zap}>
        <div className="bg-amber-900/10 border border-amber-700/30 rounded-lg px-4 py-3 flex items-start gap-3 mb-4">
          <Info size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            Cada escritório configura sua própria chave Asaas na página{' '}
            <span className="font-semibold text-amber-300">Escritórios → Asaas</span>.
            O webhook abaixo deve ser configurado automaticamente ao salvar a chave — ou manualmente
            no painel Asaas de cada escritório.
          </p>
        </div>

        <ConfigRow
          label="Ambiente Asaas"
          value={asaasEnv === 'production' ? 'Produção' : 'Sandbox'}
          badge={asaasEnv === 'production'
            ? { text: 'produção', cor: 'green' }
            : { text: 'sandbox',  cor: 'amber' }}
        />
        <ConfigRow
          label="URL do Webhook"
          value={webhookUrl}
          mono
        />
        <ConfigRow
          label="Header de autenticação"
          value="asaas-access-token"
          mono
        />

        <div className="mt-2 rounded-lg bg-slate-800/50 border border-slate-700/40 px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold text-slate-300">Eventos que o webhook recebe:</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE',
              'PAYMENT_DELETED',  'PAYMENT_REFUNDED',  'PAYMENT_CHARGEBACK_REQUESTED',
              'PAYMENT_CREATED',  'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_REFUND_DENIED',
              'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_DELETED',
            ].map((ev) => (
              <span key={ev} className="text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700/50 px-2 py-0.5 rounded">
                {ev}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Segurança */}
      <SectionCard title="Segurança" icon={ShieldCheck}>
        <ConfigRow
          label="JWT Expiration"
          value={process.env.NEXT_PUBLIC_JWT_EXPIRES ?? '8h'}
        />
        <ConfigRow
          label="Token Webhook (tamanho)"
          value="≥ 32 caracteres — definido em ASAAS_WEBHOOK_TOKEN"
          badge={{ text: 'env', cor: 'slate' }}
        />
        <ConfigRow
          label="Algoritmo JWT"
          value="HS256"
          mono
        />
      </SectionCard>

      {/* Infraestrutura */}
      <SectionCard title="Infraestrutura" icon={Database}>
        <ConfigRow
          label="Banco de dados"
          value="PostgreSQL 16"
          badge={{ text: 'prisma', cor: 'slate' }}
        />
        <ConfigRow
          label="Cache / Pub-Sub"
          value="Redis 7"
          badge={{ text: 'ioredis', cor: 'slate' }}
        />
        <ConfigRow
          label="Armazenamento de arquivos"
          value="MinIO (S3)"
          badge={{ text: 's3-compatible', cor: 'slate' }}
        />
        <ConfigRow
          label="Framework"
          value="Next.js 14 App Router (Node.js runtime)"
        />
      </SectionCard>

      {/* URLs e acessos */}
      <SectionCard title="URLs e Ambiente" icon={Globe}>
        <ConfigRow label="App URL"     value={appUrl}    mono />
        <ConfigRow label="Webhook URL" value={webhookUrl} mono />
        <ConfigRow
          label="NODE_ENV"
          value={process.env.NODE_ENV ?? 'development'}
          badge={process.env.NODE_ENV === 'production'
            ? { text: 'produção', cor: 'green' }
            : { text: 'dev',      cor: 'amber' }}
        />
      </SectionCard>

      {/* Webhook token */}
      <SectionCard title="Token do Webhook" icon={KeyRound}>
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg px-4 py-3 space-y-2">
          <p className="text-xs text-slate-300 font-medium">Como configurar no painel Asaas:</p>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Acesse o painel Asaas de cada escritório</li>
            <li>Vá em <span className="text-slate-300">Configurações → Webhooks</span></li>
            <li>Adicione a URL acima e configure o token definido em <code className="text-violet-300">ASAAS_WEBHOOK_TOKEN</code></li>
            <li>Ou salve a chave Asaas do escritório nesta plataforma — o webhook é registrado automaticamente</li>
          </ol>
        </div>
        <div className="mt-2 p-3 bg-violet-900/10 border border-violet-700/20 rounded-lg">
          <p className="text-xs text-violet-300">
            <span className="font-semibold">Nota:</span> O token deve ter{' '}
            <span className="font-mono">≥ 32 caracteres</span>. Tokens menores são rejeitados
            pelo validador do Asaas e o registro do webhook será ignorado.
          </p>
        </div>
      </SectionCard>

      {/* Inteligência Artificial */}
      <IaAdminSection onSucesso={(m) => mostrarToast('sucesso', m)} onErro={(m) => mostrarToast('erro', m)} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border
            ${toast.tipo === 'sucesso'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
              : 'bg-red-950 border-red-700 text-red-300'
            }`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              : <AlertCircle  size={16} className="text-red-400 shrink-0" />
            }
            <span className="text-sm font-medium">{toast.mensagem}</span>
          </div>
        </div>
      )}

    </div>
  );
}

// =============================================================================
// Seção interativa: Autenticação em 2 Fatores (2FA)
// =============================================================================

function TwoFactorSection({
  onSucesso,
  onErro,
}: {
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const { token } = useAuth();

  const [enabled,    setEnabled]    = useState<boolean | null>(null);
  const [step,       setStep]       = useState<'idle' | 'qr' | 'codes'>('idle');
  const [qrCode,     setQrCode]     = useState('');
  const [totpInput,  setTotpInput]  = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading,    setLoading]    = useState(false);

  // Carrega status atual
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { usuario?: { twoFactorEnabled?: boolean } }) => {
        setEnabled(d.usuario?.twoFactorEnabled ?? false);
      })
      .catch(() => setEnabled(false));
  }, [token]);

  async function handleIniciarSetup() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/setup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { qrCode?: string; message?: string };
      if (!res.ok) { onErro(data.message ?? 'Falha ao iniciar setup.'); return; }
      setQrCode(data.qrCode ?? '');
      setTotpInput('');
      setStep('qr');
    } catch {
      onErro('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAtivar() {
    if (!token || totpInput.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/enable', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ token: totpInput }),
      });
      const data = await res.json() as { backupCodes?: string[]; message?: string };
      if (!res.ok) { onErro(data.message ?? 'Código inválido.'); return; }
      setBackupCodes(data.backupCodes ?? []);
      setEnabled(true);
      setStep('codes');
      onSucesso('2FA ativado com sucesso!');
    } catch {
      onErro('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <div className="p-1.5 rounded-lg bg-violet-600/15">
          <ShieldCheck size={16} className="text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">Autenticação em 2 Fatores (2FA)</h2>
        {enabled === true && (
          <span className="ml-auto text-[10px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={10} /> Ativo
          </span>
        )}
        {enabled === false && (
          <span className="ml-auto text-[10px] font-medium text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldAlert size={10} /> Inativo
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {enabled === null && (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </div>
        )}

        {/* 2FA já ativo */}
        {enabled === true && step !== 'codes' && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-900/10 border border-emerald-700/30">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300">
              O 2FA está ativo nesta conta. Use o app autenticador para gerar códigos ao fazer login.
            </p>
          </div>
        )}

        {/* Aviso quando inativo */}
        {enabled === false && step === 'idle' && (
          <>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-900/10 border border-red-700/30">
              <ShieldAlert size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">
                Contas de administrador precisam ter o 2FA ativo para acessar o painel. Configure agora.
              </p>
            </div>
            <button
              onClick={handleIniciarSetup}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
              {loading ? 'Gerando QR Code…' : 'Configurar 2FA'}
            </button>
          </>
        )}

        {/* Step QR */}
        {step === 'qr' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Escaneie o QR Code abaixo com um app autenticador (Google Authenticator, Authy, etc.) e insira o código gerado para confirmar.
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl inline-block">
                  <img src={qrCode} alt="QR Code 2FA" className="w-44 h-44" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Código de verificação (6 dígitos)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpInput}
                onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-40 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 tracking-widest"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAtivar}
                disabled={loading || totpInput.length !== 6}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                {loading ? 'Ativando…' : 'Ativar 2FA'}
              </button>
              <button
                onClick={() => setStep('idle')}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Step códigos de backup */}
        {step === 'codes' && backupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-900/10 border border-amber-700/30">
              <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <span className="font-semibold">Guarde estes códigos de backup em local seguro.</span>{' '}
                Eles permitem recuperar acesso caso perca o app autenticador. Cada código só pode ser usado uma vez.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <span key={i} className="font-mono text-xs text-slate-200 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-center tracking-widest">
                  {code}
                </span>
              ))}
            </div>
            <button
              onClick={() => setStep('idle')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
            >
              <CheckCircle2 size={13} />
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Seção interativa: Configuração de IA do Sistema
// =============================================================================

function IaAdminSection({
  onSucesso,
  onErro,
}: {
  onSucesso: (msg: string) => void;
  onErro:    (msg: string) => void;
}) {
  const { token } = useAuth();

  const [provider,   setProvider]   = useState<IaProvider>('anthropic');
  const [apiKey,     setApiKey]     = useState('');
  const [keySet,     setKeySet]     = useState(false);
  const [mostrarKey, setMostrarKey] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando,   setSalvando]   = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/v1/admin/sistema/ia', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { iaProvider: IaProvider | null; iaKeySet: boolean };
          if (data.iaProvider) setProvider(data.iaProvider);
          setKeySet(data.iaKeySet);
        }
      } catch { /* ignore */ } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!apiKey && !keySet) { onErro('Informe a chave de API.'); return; }
    setSalvando(true);
    try {
      const body: { iaProvider: IaProvider; iaApiKey?: string } = { iaProvider: provider };
      if (apiKey.trim()) body.iaApiKey = apiKey.trim();
      const res = await fetch('/api/v1/admin/sistema/ia', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { onErro(data.message ?? 'Erro ao salvar.'); return; }
      setKeySet(true);
      setApiKey('');
      onSucesso('Configuração de IA salva com sucesso!');
    } catch {
      onErro('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  const KEY_LINKS: Record<IaProvider, string> = {
    anthropic: 'console.anthropic.com',
    openai:    'platform.openai.com/api-keys',
    google:    'aistudio.google.com/app/apikey',
    deepseek:  'platform.deepseek.com',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <div className="p-1.5 rounded-lg bg-violet-600/15">
          <Bot size={16} className="text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">Inteligência Artificial</h2>
        {keySet && (
          <span className="ml-auto text-[10px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full">
            configurada
          </span>
        )}
      </div>

      <form onSubmit={handleSalvar} className="px-5 py-4 space-y-5">
        <p className="text-xs text-slate-400 leading-relaxed">
          Chave de IA centralizada — todos os contadores usam este provider para gerar o calendário fiscal dos clientes.
          A chave nunca é exibida após salva.
        </p>

        {carregando ? (
          <div className="flex items-center gap-2 py-2 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            {/* Provider */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">Provedor</p>
              <div className="grid grid-cols-2 gap-2">
                {IA_PROVIDERS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors
                      ${provider === p.id
                        ? 'border-violet-500/60 bg-violet-600/10'
                        : 'border-slate-700 hover:border-slate-600'
                      }`}
                  >
                    <input
                      type="radio"
                      name="iaProvider"
                      value={p.id}
                      checked={provider === p.id}
                      onChange={() => setProvider(p.id)}
                      className="mt-0.5 accent-violet-500"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-200">{p.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.modelLabel}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Chave de API */}
            <div className="space-y-1.5">
              <label htmlFor="admin-ia-key" className="block text-xs font-medium text-slate-300">
                Chave de API{' '}
                {keySet && <span className="text-slate-500 font-normal">(deixe em branco para manter a atual)</span>}
              </label>
              <div className="relative">
                <input
                  id="admin-ia-key"
                  type={mostrarKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={keySet ? '••••••••••••••••' : 'sk-ant-... / sk-... / AIza...'}
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10
                             text-xs text-slate-100 placeholder:text-slate-600
                             focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setMostrarKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {mostrarKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Obtenha em: <span className="text-violet-400">{KEY_LINKS[provider]}</span>
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs
                           font-semibold text-white hover:bg-violet-500 disabled:opacity-50
                           disabled:cursor-not-allowed transition-colors"
              >
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
