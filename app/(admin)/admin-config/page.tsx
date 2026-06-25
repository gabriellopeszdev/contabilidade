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
  Settings,
  ExternalLink,
  Activity,
  Server,
  Cpu,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { IA_PROVIDERS, type IaProvider } from '../../../src/utils/aiProviders';

// =============================================================================
// Componentes auxiliares
// =============================================================================

function SectionCard({ title, icon: Icon, accent = 'violet', badge, children }: {
  title:    string;
  icon:     React.ElementType;
  accent?:  'violet' | 'blue' | 'emerald' | 'amber' | 'rose';
  badge?:   React.ReactNode;
  children: React.ReactNode;
}) {
  const accents = {
    violet:  { border: 'border-l-violet-500',  icon: 'bg-violet-600/15 text-violet-400' },
    blue:    { border: 'border-l-blue-500',    icon: 'bg-blue-600/15 text-blue-400' },
    emerald: { border: 'border-l-emerald-500', icon: 'bg-emerald-600/15 text-emerald-400' },
    amber:   { border: 'border-l-amber-500',   icon: 'bg-amber-600/15 text-amber-400' },
    rose:    { border: 'border-l-rose-500',    icon: 'bg-rose-600/15 text-rose-400' },
  };
  const a = accents[accent];

  return (
    <div className={`bg-slate-900 border border-slate-800 border-l-2 ${a.border} rounded-xl overflow-hidden shadow-sm`}>
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/80">
        <div className={`p-1.5 rounded-lg ${a.icon.split(' ')[0]}`}>
          <Icon size={15} className={a.icon.split(' ')[1]} />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'warn' | 'off' | 'env' }) {
  const map = {
    ok:  { label: 'Ativo',     cls: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/50', dot: 'bg-emerald-400' },
    warn:{ label: 'Sandbox',   cls: 'text-amber-400   bg-amber-900/30   border-amber-700/50',   dot: 'bg-amber-400' },
    off: { label: 'Inativo',   cls: 'text-red-400     bg-red-900/30     border-red-700/50',     dot: 'bg-red-400' },
    env: { label: 'via .env',  cls: 'text-slate-400   bg-slate-800/60   border-slate-700/50',   dot: 'bg-slate-500' },
  };
  const { label, cls, dot } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold border px-2.5 py-1 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dot}`} />
      {label}
    </span>
  );
}

function ConfigRow({ label, value, mono, badge, icon: Icon, copyable = true }: {
  label:     string;
  value:     string;
  mono?:     boolean;
  badge?:    { text: string; cor: 'green' | 'amber' | 'slate' };
  icon?:     React.ElementType;
  copyable?: boolean;
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
    <div className="group flex items-center justify-between py-2.5 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && <Icon size={13} className="text-slate-500 shrink-0" />}
        <span className="text-[11px] font-medium text-slate-500 shrink-0 w-44">{label}</span>
        <span className={`text-xs truncate ${mono ? 'font-mono text-cyan-300' : 'text-slate-200'}`}>
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded-full shrink-0 ${badgeCores[badge.cor]}`}>
            {badge.text}
          </span>
        )}
      </div>
      {copyable && (
        <button
          onClick={copiar}
          className="ml-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-all shrink-0"
          title="Copiar"
        >
          {copiado
            ? <CheckCheck size={12} className="text-emerald-400" />
            : <Copy size={12} />
          }
        </button>
      )}
    </div>
  );
}

const EVENT_GROUPS: { label: string; color: string; events: string[] }[] = [
  {
    label: 'Pagamento',
    color: 'text-emerald-300 bg-emerald-900/20 border-emerald-700/30',
    events: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_CREATED'],
  },
  {
    label: 'Problema',
    color: 'text-red-300 bg-red-900/20 border-red-700/30',
    events: ['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_REFUND_DENIED'],
  },
  {
    label: 'Reembolso',
    color: 'text-amber-300 bg-amber-900/20 border-amber-700/30',
    events: ['PAYMENT_REFUNDED', 'PAYMENT_REFUND_IN_PROGRESS'],
  },
  {
    label: 'Assinatura',
    color: 'text-violet-300 bg-violet-900/20 border-violet-700/30',
    events: ['SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_DELETED'],
  },
];

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
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 px-6 py-5 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-violet-600/15 border border-violet-500/20">
          <Settings size={20} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Configurações do Sistema</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Variáveis de ambiente definidas no arquivo{' '}
            <code className="text-violet-300 bg-violet-950/50 px-1 py-0.5 rounded">.env</code>
            {' '}— aplique mudanças reiniciando o container.
          </p>
        </div>
      </div>

      {/* Autenticação em 2 Fatores */}
      <TwoFactorSection onSucesso={(m) => mostrarToast('sucesso', m)} onErro={(m) => mostrarToast('erro', m)} />

      {/* Integração Asaas */}
      <SectionCard
        title="Integração Asaas"
        icon={Zap}
        accent="amber"
        badge={
          <StatusBadge status={asaasEnv === 'production' ? 'ok' : 'warn'} />
        }
      >
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-950/30 border border-amber-700/25 mb-1">
          <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            Cada escritório configura sua própria chave Asaas em{' '}
            <span className="font-semibold text-amber-300">Escritórios → Asaas</span>.
            O webhook é registrado automaticamente ao salvar — ou manualmente no painel Asaas.
          </p>
        </div>

        <ConfigRow
          label="Ambiente"
          value={asaasEnv === 'production' ? 'Produção' : 'Sandbox'}
          badge={asaasEnv === 'production'
            ? { text: 'production', cor: 'green' }
            : { text: 'sandbox',    cor: 'amber' }}
          icon={Globe}
        />
        <ConfigRow
          label="URL do Webhook"
          value={webhookUrl}
          mono
          icon={Webhook}
        />
        <ConfigRow
          label="Header de autenticação"
          value="asaas-access-token"
          mono
          icon={KeyRound}
        />

        <div className="mt-1 rounded-lg bg-slate-800/40 border border-slate-700/40 p-4">
          <p className="text-[11px] font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
            <Activity size={11} className="text-slate-400" />
            Eventos monitorados pelo webhook
          </p>
          <div className="space-y-2.5">
            {EVENT_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.events.map((ev) => (
                    <span
                      key={ev}
                      className={`text-[10px] font-mono font-medium border px-2 py-0.5 rounded-md ${group.color}`}
                    >
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Segurança */}
      <SectionCard title="Segurança" icon={ShieldCheck} accent="emerald">
        <ConfigRow
          label="JWT Expiration"
          value={process.env.NEXT_PUBLIC_JWT_EXPIRES ?? '8h'}
          icon={Lock}
          badge={{ text: 'HS256', cor: 'slate' }}
        />
        <ConfigRow
          label="Token Webhook"
          value="≥ 32 chars — ASAAS_WEBHOOK_TOKEN"
          icon={KeyRound}
          badge={{ text: 'env', cor: 'slate' }}
          copyable={false}
        />
        <ConfigRow
          label="Algoritmo JWT"
          value="HS256"
          mono
          icon={ShieldCheck}
          copyable={false}
        />
      </SectionCard>

      {/* Infraestrutura */}
      <SectionCard title="Infraestrutura" icon={Server} accent="blue">
        <ConfigRow label="Banco de dados"          value="PostgreSQL 16"                               icon={Database} badge={{ text: 'prisma',       cor: 'slate' }} />
        <ConfigRow label="Cache / Pub-Sub"         value="Redis 7"                                    icon={Cpu}      badge={{ text: 'ioredis',       cor: 'slate' }} />
        <ConfigRow label="Armazenamento"           value="MinIO (S3-compatible)"                      icon={Server}   badge={{ text: 's3',            cor: 'slate' }} />
        <ConfigRow label="Framework"               value="Next.js 14 App Router — Node.js runtime"   icon={Globe}    copyable={false} />
      </SectionCard>

      {/* URLs e acessos */}
      <SectionCard title="URLs e Ambiente" icon={Globe} accent="blue">
        <ConfigRow label="App URL"     value={appUrl}    mono icon={Globe} />
        <ConfigRow label="Webhook URL" value={webhookUrl} mono icon={Webhook} />
        <ConfigRow
          label="NODE_ENV"
          value={process.env.NODE_ENV ?? 'development'}
          mono
          icon={Server}
          badge={process.env.NODE_ENV === 'production'
            ? { text: 'produção', cor: 'green' }
            : { text: 'dev',      cor: 'amber' }}
        />
      </SectionCard>

      {/* Webhook token */}
      <SectionCard title="Como configurar o Webhook" icon={KeyRound} accent="violet">
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/40 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-300 font-medium">Passo a passo no painel Asaas:</p>
          <ol className="text-xs text-slate-400 space-y-1.5 list-none">
            {[
              <>Acesse o painel Asaas de cada escritório</>,
              <>Vá em <span className="text-slate-300 font-medium">Configurações → Webhooks</span></>,
              <>Adicione a URL acima e configure o token em <code className="text-violet-300 bg-violet-950/50 px-1 rounded">ASAAS_WEBHOOK_TOKEN</code></>,
              <>Ou salve a chave Asaas nesta plataforma — o webhook é registrado automaticamente</>,
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-violet-600/20 border border-violet-500/30 text-[9px] font-bold text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="p-3 bg-violet-900/10 border border-violet-700/20 rounded-lg">
          <p className="text-xs text-violet-300">
            <span className="font-semibold">Atenção:</span> O token deve ter{' '}
            <span className="font-mono text-violet-200">≥ 32 caracteres</span>. Tokens menores são rejeitados
            pelo Asaas e o registro do webhook será ignorado silenciosamente.
          </p>
        </div>
      </SectionCard>

      {/* Inteligência Artificial */}
      <IaAdminSection onSucesso={(m) => mostrarToast('sucesso', m)} onErro={(m) => mostrarToast('erro', m)} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm
            ${toast.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-300'
              : 'bg-red-950/90 border-red-700/60 text-red-300'
            }`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              : <AlertCircle  size={15} className="text-red-400 shrink-0" />
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

  const badge = enabled === true
    ? <StatusBadge status="ok" />
    : enabled === false
      ? <StatusBadge status="off" />
      : null;

  return (
    <div className="bg-slate-900 border border-slate-800 border-l-2 border-l-violet-500 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/80">
        <div className="p-1.5 rounded-lg bg-violet-600/15">
          <ShieldCheck size={15} className="text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">Autenticação em 2 Fatores (2FA)</h2>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>

      <div className="px-5 py-4 space-y-4">
        {enabled === null && (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </div>
        )}

        {enabled === true && step !== 'codes' && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-900/10 border border-emerald-700/25">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300 leading-relaxed">
              O 2FA está ativo nesta conta. Use o app autenticador para gerar códigos ao fazer login.
            </p>
          </div>
        )}

        {enabled === false && step === 'idle' && (
          <>
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-900/10 border border-red-700/25">
              <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">
                Contas de administrador precisam ter o 2FA ativo para acessar o painel. Configure agora.
              </p>
            </div>
            <button
              onClick={handleIniciarSetup}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-violet-900/30"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
              {loading ? 'Gerando QR Code…' : 'Configurar 2FA'}
            </button>
          </>
        )}

        {step === 'qr' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Escaneie o QR Code abaixo com um app autenticador (Google Authenticator, Authy, etc.) e insira o código gerado para confirmar.
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl inline-block ring-2 ring-violet-500/20">
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
                className="w-40 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 tracking-widest transition"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAtivar}
                disabled={loading || totpInput.length !== 6}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-violet-900/30"
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

        {step === 'codes' && backupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-900/10 border border-amber-700/25">
              <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors shadow-sm"
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
    <div className="bg-slate-900 border border-slate-800 border-l-2 border-l-blue-500 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/80">
        <div className="p-1.5 rounded-lg bg-blue-600/15">
          <Bot size={15} className="text-blue-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">Inteligência Artificial</h2>
        {keySet && (
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold border border-emerald-700/50 px-2.5 py-1 rounded-full text-emerald-400 bg-emerald-900/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              configurada
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSalvar} className="px-5 py-4 space-y-5">
        <p className="text-xs text-slate-400 leading-relaxed">
          Chave centralizada — todos os contadores usam este provider para gerar o calendário fiscal dos clientes.
          A chave nunca é exibida após salva.
        </p>

        {carregando ? (
          <div className="flex items-center gap-2 py-2 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">Provedor</p>
              <div className="grid grid-cols-2 gap-2">
                {IA_PROVIDERS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-all
                      ${provider === p.id
                        ? 'border-violet-500/60 bg-violet-600/10 shadow-sm shadow-violet-900/20'
                        : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/40'
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {mostrarKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <ExternalLink size={10} className="text-violet-400" />
                Obtenha em:{' '}
                <span className="text-violet-400">{KEY_LINKS[provider]}</span>
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs
                           font-semibold text-white hover:bg-violet-500 disabled:opacity-50
                           disabled:cursor-not-allowed transition-colors shadow-sm shadow-violet-900/30"
              >
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {salvando ? 'Salvando…' : 'Salvar configuração'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
