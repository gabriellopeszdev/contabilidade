'use client';

import { useState } from 'react';
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
} from 'lucide-react';

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

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configurações globais do sistema. Variáveis de ambiente são definidas no arquivo <code className="text-violet-300 text-[11px]">.env</code>.
        </p>
      </div>

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

    </div>
  );
}
