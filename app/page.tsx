'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileSignature,
  Lock,
  ShieldCheck,
  Zap,
  Cloud,
  Users,
  ChevronRight,
  Bot,
  Sparkles,
  TrendingUp,
  FileText,
  Brain,
  XCircle,
  Building2,
  MessageSquare,
  BarChart3,
  Banknote,
} from 'lucide-react';
import { FiscoHubLogo } from './components/FiscoHubLogo';
import { useAuth } from '../src/presentation/hooks/useAuth';

// =============================================================================
// Constantes de rota
// =============================================================================

const ROTA_DASHBOARD: Record<string, string> = {
  Contador: '/dashboard',
  Cliente:  '/inicio',
  Admin:    '/dashboard-admin',
};
const LABEL_DASHBOARD: Record<string, string> = {
  Contador: 'Ir para o painel',
  Cliente:  'Ir para o meu portal',
  Admin:    'Ir para o admin',
};

// =============================================================================
// Dados
// =============================================================================

const FEATURES = [
  {
    icon: CalendarClock,
    color: 'from-blue-500 to-blue-600',
    shadow: 'shadow-blue-500/30',
    titulo: 'Automação Fiscal',
    descricao: 'Nunca mais perca um prazo. Obrigações, boletos e relatórios gerados e enviados automaticamente.',
    itens: [
      'Lembretes 7 dias antes do vencimento',
      'Relatório mensal automático por e-mail',
      'Alertas de boletos em 3 dias',
      'Geração automática de obrigações recorrentes',
    ],
    dir: 'left' as const,
  },
  {
    icon: Users,
    color: 'from-violet-500 to-violet-600',
    shadow: 'shadow-violet-500/30',
    titulo: 'Portal do Cliente',
    descricao: 'Cada cliente tem seu próprio painel para enviar documentos, assinar e se comunicar.',
    itens: [
      'Chat em tempo real via WebSocket',
      'Envio e gestão de documentos',
      'Notificações instantâneas',
      'Histórico completo de interações',
    ],
    dir: 'right' as const,
  },
  {
    icon: Banknote,
    color: 'from-emerald-500 to-emerald-600',
    shadow: 'shadow-emerald-500/30',
    titulo: 'Integração Bancária',
    descricao: 'Boletos, PIX e cobranças automáticas via Asaas e Cora — sem sair da plataforma.',
    itens: [
      'Boletos e PIX via Asaas (qualquer banco)',
      'Cobranças automáticas via Cora (MEI/PJ)',
      'Webhook automático de pagamentos',
      'Estorno e cancelamento integrados',
    ],
    dir: 'left' as const,
  },
  {
    icon: FileSignature,
    color: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-500/30',
    titulo: 'Assinatura Eletrônica',
    descricao: 'Solicite assinaturas com link seguro de 72h. Rastreamento de IP, data e hora com validade jurídica.',
    itens: [
      'Link seguro com expiração configurável',
      'Registro de IP, data e hora',
      'Notificação por e-mail ao assinar',
      'Dashboard de assinaturas pendentes',
    ],
    dir: 'right' as const,
  },
];

const IA_RECURSOS = [
  {
    icon: Bot,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    titulo: 'Assistente Contábil',
    descricao: 'Tire dúvidas sobre obrigações, regimes e legislação em linguagem natural. Histórico persistente.',
  },
  {
    icon: MessageSquare,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    titulo: 'Chat por Cliente',
    descricao: 'IA com contexto automático do cliente: CNPJ, regime tributário e CNAE já carregados.',
  },
  {
    icon: FileText,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    titulo: 'Análise de NF-e',
    descricao: 'Importe XMLs e peça à IA para identificar inconsistências fiscais e oportunidades de economia.',
  },
  {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    titulo: 'Sugestão de Regime',
    descricao: 'Recomendação de regime tributário com justificativa, vantagens e alertas baseados no perfil.',
  },
];

const MARQUEE_ITEMS = [
  'Asaas', 'Cora', 'Assinatura Digital', 'PIX QR Code', 'Chat em Tempo Real',
  'Assistente IA', 'LGPD Compliant', '2FA com TOTP', 'Calendário Fiscal',
  'Análise de NF-e', 'Self-hosted', 'Open Source', 'Sugestão de Regime', 'Gestão de Equipe',
];

const STEPS = [
  { numero: '01', titulo: 'Configure seu escritório', descricao: 'Cadastre seus clientes, defina as obrigações fiscais e conecte sua conta bancária em minutos.' },
  { numero: '02', titulo: 'Automatize os processos',  descricao: 'O FiscoHub cuida dos lembretes, relatórios, cobranças e notificações enquanto você foca no que importa.' },
  { numero: '03', titulo: 'Colabore em tempo real',   descricao: 'Chat, assinaturas e documentos num portal exclusivo para cada cliente. Sem e-mail, sem papel.' },
];

const PLANOS_LANDING = [
  {
    nome: 'Básico', preco: '89', destaque: false, ia: false,
    descricao: 'Para escritórios pequenos que estão começando.',
    features: [
      { label: 'Até 20 clientes',           ok: true },
      { label: '1.000 documentos/mês',       ok: true },
      { label: 'Portal do cliente',          ok: true },
      { label: 'Chat em tempo real',         ok: true },
      { label: 'Calendário fiscal',          ok: true },
      { label: 'Cobranças (Asaas e Cora)',   ok: true },
      { label: 'Assinatura eletrônica',      ok: true },
      { label: 'Relatórios avançados',       ok: true },
      { label: 'Gestão de equipe',           ok: true },
      { label: 'Assistente IA',              ok: true },
    ],
  },
  {
    nome: 'Pro', preco: '189', destaque: true, ia: false,
    descricao: 'Para escritórios em crescimento com mais recursos.',
    features: [
      { label: 'Até 100 clientes',           ok: true },
      { label: '5.000 documentos/mês',       ok: true },
      { label: 'Portal do cliente',          ok: true },
      { label: 'Chat em tempo real',         ok: true },
      { label: 'Calendário fiscal',          ok: true },
      { label: 'Cobranças (Asaas e Cora)',   ok: true },
      { label: 'Assinatura eletrônica',      ok: true },
      { label: 'Relatórios avançados',       ok: true },
      { label: 'Gestão de equipe',           ok: true },
      { label: 'Assistente IA',              ok: true },
    ],
  },
  {
    nome: 'Enterprise', preco: '389', destaque: false, ia: true,
    descricao: 'Clientes e documentos ilimitados. Todos os recursos, incluindo IA.',
    features: [
      { label: 'Clientes ilimitados',          ok: true },
      { label: 'Documentos ilimitados',         ok: true },
      { label: 'Portal do cliente',             ok: true },
      { label: 'Chat em tempo real',            ok: true },
      { label: 'Calendário fiscal',             ok: true },
      { label: 'Cobranças (Asaas e Cora)',      ok: true },
      { label: 'Assinatura eletrônica',         ok: true },
      { label: 'Relatórios avançados',          ok: true },
      { label: 'Gestão de equipe ilimitada',    ok: true },
      { label: 'Assistente IA completo',        ok: true, destaque: true },
    ],
  },
];

const TRUST = [
  { icon: ShieldCheck, titulo: 'LGPD Compliant',  descricao: 'Dados armazenados em servidor próprio. Sem compartilhamento com terceiros.' },
  { icon: Lock,        titulo: '2FA com TOTP',    descricao: 'Autenticação em dois fatores com app autenticador (Google, Authy, etc.).' },
  { icon: Cloud,       titulo: 'Self-hosted',     descricao: 'Você controla a infraestrutura. Seus dados nunca saem do seu servidor.' },
  { icon: Zap,         titulo: 'Open Source',     descricao: 'Código aberto, auditável e sem vendor lock-in. Customize como quiser.' },
];

const INTEGRACOES = [
  { nome: 'Asaas',    descricao: 'Boletos, PIX e cobranças recorrentes para qualquer banco',       cor: 'border-blue-500/30   bg-blue-500/5',   icon: CreditCard,  iconColor: 'text-blue-400'    },
  { nome: 'Cora',     descricao: 'Banco digital MEI/PJ com cobrança automática integrada',          cor: 'border-emerald-500/30 bg-emerald-500/5', icon: Building2,   iconColor: 'text-emerald-400' },
  { nome: 'IA (multi-provider)', descricao: 'Claude, GPT-4o, Gemini, DeepSeek — você escolhe', cor: 'border-violet-500/30  bg-violet-500/5',  icon: Brain,       iconColor: 'text-violet-400'  },
  { nome: 'DocSeal',  descricao: 'Assinatura eletrônica com validade jurídica e rastreamento',     cor: 'border-amber-500/30  bg-amber-500/5',   icon: FileSignature, iconColor: 'text-amber-400' },
  { nome: 'WebSocket',descricao: 'Chat em tempo real com clientes — notificações instantâneas',    cor: 'border-blue-500/30   bg-blue-500/5',   icon: MessageSquare, iconColor: 'text-blue-400'  },
  { nome: 'Relatórios', descricao: 'Exportação PDF/Excel e busca global por documentos',           cor: 'border-slate-500/30  bg-slate-500/5',  icon: BarChart3,   iconColor: 'text-slate-400'  },
];

// Palavras que o typewriter vai ciclar
const TYPEWRITER_WORDS = ['Automação Fiscal', 'Inteligência Artificial', 'Assinatura Digital', 'Integração Cora', 'Chat em Tempo Real'];

// =============================================================================
// Hooks
// =============================================================================

function useRevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.10 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function useTypewriter(words: string[], speed = 60, pause = 2000) {
  const [text, setText]       = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = words[wordIdx % words.length];

    const tick = () => {
      if (!deleting) {
        setText(current.slice(0, text.length + 1));
        if (text.length + 1 === current.length) {
          timeoutRef.current = setTimeout(() => setDeleting(true), pause);
          return;
        }
      } else {
        setText(current.slice(0, text.length - 1));
        if (text.length - 1 === 0) {
          setDeleting(false);
          setWordIdx((i) => i + 1);
          return;
        }
      }
      timeoutRef.current = setTimeout(tick, deleting ? speed / 2 : speed);
    };

    timeoutRef.current = setTimeout(tick, deleting ? speed / 2 : speed);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [text, deleting, wordIdx, words, speed, pause]);

  return text;
}


// =============================================================================
// Sub-componentes
// =============================================================================

function MarqueeStrip() {
  // Triplicamos para garantir que nunca vemos o fim — o loop percorre 1/3 do total
  const tripled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="relative py-5 overflow-hidden border-y border-white/5 bg-white/[0.015]">
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #0a0f1e, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #0a0f1e, transparent)' }} />

      <div
        className="flex items-center whitespace-nowrap"
        style={{ animation: 'marquee-third 30s linear infinite', willChange: 'transform' }}
      >
        {tripled.map((label, i) => (
          <Fragment key={i}>
            <span className="text-sm font-medium text-slate-400 px-7">{label}</span>
            <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function LandingPage() {
  const { usuario, role } = useAuth();
  const dashHref  = role ? (ROTA_DASHBOARD[role]  ?? '/dashboard') : '/login';
  const dashLabel = role ? (LABEL_DASHBOARD[role] ?? 'Ir para o painel') : null;
  useRevealOnScroll();

  const typed = useTypewriter(TYPEWRITER_WORDS, 55, 2200);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white antialiased overflow-x-hidden">

      {/* ================================================================ */}
      {/* HEADER                                                             */}
      {/* ================================================================ */}
      <header
        className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl"
        style={{ animation: 'fadeInDown 0.5s ease both' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <FiscoHubLogo size="sm" className="[&_span]:!text-white" />

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#funcionalidades"  className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#ia"               className="hover:text-white transition-colors flex items-center gap-1">
              <Sparkles size={12} className="text-violet-400" />IA
            </a>
            <a href="#integracoes"      className="hover:text-white transition-colors">Integrações</a>
            <a href="#planos"           className="hover:text-white transition-colors">Planos</a>
            <a href="#seguranca"        className="hover:text-white transition-colors">Segurança</a>
          </nav>

          <Link
            href={usuario ? dashHref : '/login'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all hover:scale-105 active:scale-95"
          >
            {dashLabel ?? 'Acessar'}
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      {/* ================================================================ */}
      {/* HERO                                                               */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden pt-24 pb-10 sm:pt-32 sm:pb-16">

        {/* Blobs */}
        <div className="animate-float absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
        <div className="animate-float-slow absolute top-20 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[100px] pointer-events-none" />
        <div className="animate-float absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[180px] bg-blue-500/10 blur-[80px] pointer-events-none" style={{ animationDelay: '3s' }} />

        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8"
            style={{ animation: 'fadeInDown 0.6s 0.1s ease both' }}
          >
            <Sparkles size={11} className="text-violet-400" />
            Agora com Assistente IA e Integração Cora
            <Sparkles size={11} className="text-violet-400" />
          </div>

          {/* H1 */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-4"
            style={{ animation: 'fadeInUp 0.7s 0.2s ease both' }}
          >
            Seu escritório contábil
            <br />
            <span
              className="animate-gradient bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #60a5fa, #a78bfa, #34d399, #60a5fa)' }}
            >
              no próximo nível
            </span>
          </h1>

          {/* Typewriter */}
          <div
            className="h-8 flex items-center justify-center mb-6"
            style={{ animation: 'fadeInUp 0.7s 0.3s ease both' }}
          >
            <span className="text-sm sm:text-base text-slate-400 font-mono">
              {typed}
              <span className="animate-cursor ml-0.5 border-r-2 border-violet-400 inline-block">&nbsp;</span>
            </span>
          </div>

          {/* Subtítulo */}
          <p
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ animation: 'fadeInUp 0.7s 0.35s ease both' }}
          >
            Automatize obrigações fiscais, colabore com clientes em tempo real, gerencie cobranças
            via Asaas e Cora, e conte com um Assistente IA para análises tributárias.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
            style={{ animation: 'fadeInUp 0.7s 0.5s ease both' }}
          >
            <Link
              href={usuario ? dashHref : '/login'}
              className="group relative flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
            >
              {/* Ping decorativo */}
              <span className="absolute -top-1 -right-1 w-3 h-3">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
              </span>
              {dashLabel ?? 'Acessar o sistema'}
              <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#funcionalidades"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all hover:scale-105 active:scale-95"
            >
              Ver funcionalidades
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* MARQUEE                                                            */}
      {/* ================================================================ */}
      <MarqueeStrip />

      {/* ================================================================ */}
      {/* FUNCIONALIDADES                                                    */}
      {/* ================================================================ */}
      <section id="funcionalidades" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Tudo que seu escritório precisa
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Uma plataforma integrada — do lançamento fiscal à assinatura do cliente.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.titulo}
                  data-reveal
                  data-dir={f.dir}
                  data-delay={String(i + 1)}
                  className="group rounded-2xl border border-white/8 bg-white/[0.03] p-7 hover:bg-white/[0.06] hover:border-white/15 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg ${f.shadow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.titulo}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-5">{f.descricao}</p>
                  <ul className="space-y-2">
                    {f.itens.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ASSISTENTE IA                                                      */}
      {/* ================================================================ */}
      <section id="ia" className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">
              <Brain size={12} />Exclusivo Enterprise
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Inteligência Artificial para
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                análises tributárias
              </span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Quatro ferramentas de IA integradas ao sistema. Treine menos, analise mais — com contexto real dos seus clientes.
            </p>
          </div>

          {/* 4 cards bento */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {IA_RECURSOS.map((r, i) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.titulo}
                  data-reveal
                  data-delay={String(i + 1)}
                  className={`rounded-2xl border p-5 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 ${r.bg}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                    <Icon size={18} className={r.color} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-2">{r.titulo}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{r.descricao}</p>
                </div>
              );
            })}
          </div>

          {/* Card grande — mock de chat */}
          <div data-reveal className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-900/20 to-blue-900/10 p-8 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">Assistente Contábil</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 leading-snug">
                  Configuração flexível de IA
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-5">
                  Você escolhe o provedor: Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google) ou DeepSeek.
                  Histórico persistente de conversas por contador.
                </p>
                <ul className="space-y-2">
                  {['Chave de IA global configurada pelo admin', 'Override por escritório (chave própria)', 'Histórico persistente de conversas', 'Contexto automático do cliente'].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 size={13} className="text-violet-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mock chat */}
              <div className="bg-[#0d1224] rounded-2xl border border-white/8 p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                    <Bot size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-slate-300">Assistente Contábil IA</span>
                  <span className="ml-auto text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Online
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={10} className="text-white" />
                  </div>
                  <div className="bg-white/5 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-slate-300 max-w-[85%]">
                    Olá! Sou seu assistente contábil. Como posso ajudar?
                  </div>
                </div>
                <div className="flex gap-2 flex-row-reverse">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[8px] font-bold text-white">VC</span>
                  </div>
                  <div className="bg-blue-500/80 rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white max-w-[85%]">
                    Qual regime é melhor para um e-commerce com R$ 2,4M/ano?
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={10} className="text-white" />
                  </div>
                  <div className="bg-white/5 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-slate-300 max-w-[85%]">
                    Para esse faturamento o <span className="text-violet-300 font-semibold">Lucro Presumido</span> costuma ser mais vantajoso que o Simples (alíquota efetiva maior no Anexo I)…
                  </div>
                </div>
                <div className="flex gap-1 pl-7 items-center text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* INTEGRAÇÕES                                                        */}
      {/* ================================================================ */}
      <section id="integracoes" className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/8 to-transparent pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Integrações</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Conectado ao que você já usa
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Asaas, Cora, IA multi-provider e assinatura eletrônica — tudo nativo, sem plugins externos.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRACOES.map((integ, i) => {
              const Icon = integ.icon;
              return (
                <div
                  key={integ.nome}
                  data-reveal
                  data-delay={String(i + 1)}
                  className={`rounded-2xl border p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ${integ.cor}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                      <Icon size={18} className={integ.iconColor} />
                    </div>
                    <span className="font-bold text-white text-sm">{integ.nome}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{integ.descricao}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* COMO FUNCIONA                                                      */}
      {/* ================================================================ */}
      <section id="como-funciona" className="py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Processo</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simples de começar, poderoso para crescer
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Três passos para transformar a operação do seu escritório.
            </p>
          </div>

          <div className="relative">
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px overflow-hidden">
              <div className="h-full animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #3b82f6, transparent)', backgroundSize: '200% auto' }} />
            </div>
            <div className="grid sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <div key={step.numero} data-reveal data-delay={String(i + 1)} className="flex flex-col items-center text-center">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-2xl border border-blue-500/40 bg-blue-500/10" style={{ animation: `pulse-ring 3s ${i * 0.8}s ease-out infinite` }} />
                    <div className="absolute inset-0 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-center z-10">
                      <span className="text-2xl font-bold text-blue-400">{step.numero}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{step.titulo}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PLANOS                                                             */}
      {/* ================================================================ */}
      <section id="planos" className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-violet-600/8 blur-[80px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Planos</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Escolha o plano ideal</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">Sem taxa de adesão. Cancele quando quiser. Suporte incluso.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 items-start">
            {PLANOS_LANDING.map((plano, i) => (
              <div
                key={plano.nome}
                data-reveal
                data-delay={String(i + 1)}
                className={`relative rounded-2xl border p-7 flex flex-col gap-5 transition-all duration-300 ${
                  plano.destaque
                    ? 'border-violet-500/40 bg-violet-500/5 hover:border-violet-500/60 hover:bg-violet-500/10 scale-[1.02]'
                    : plano.ia
                    ? 'animate-glow-pulse border-blue-500/30 bg-gradient-to-b from-blue-900/10 to-violet-900/10 hover:border-blue-500/50'
                    : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Mais popular</span>
                  </div>
                )}
                {plano.ia && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      <Sparkles size={9} />Com IA
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-white text-lg mb-1">{plano.nome}</h3>
                  <p className="text-slate-400 text-sm">{plano.descricao}</p>
                </div>
                <div>
                  <span className="text-4xl font-bold text-white">R$ {plano.preco}</span>
                  <span className="text-slate-400 text-sm">/mês</span>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plano.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-sm">
                      {f.ok ? (
                        <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${'destaque' in f && f.destaque ? 'text-violet-400' : 'text-emerald-400'}`} />
                      ) : (
                        <XCircle size={15} className="text-slate-700 mt-0.5 shrink-0" />
                      )}
                      <span className={f.ok ? ('destaque' in f && f.destaque ? 'text-violet-300 font-semibold' : 'text-slate-300') : 'text-slate-600'}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/cadastro?plano=${encodeURIComponent(plano.nome)}`}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 ${
                    plano.destaque
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30'
                      : plano.ia
                      ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-600/20'
                      : 'border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Contratar<ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SEGURANÇA                                                          */}
      {/* ================================================================ */}
      <section id="seguranca" className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-emerald-600/8 blur-[80px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Segurança & Privacidade</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Construído com segurança desde o início</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Self-hosted, LGPD compliant e com autenticação de dois fatores. Seus dados, suas regras.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST.map((t, i) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.titulo}
                  data-reveal
                  data-delay={String(i + 1)}
                  className="group rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-6 hover:bg-emerald-500/10 hover:-translate-y-1 hover:border-emerald-500/30 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-500/25 transition-all duration-300">
                    <Icon size={18} className="text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-2">{t.titulo}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.descricao}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA FINAL                                                          */}
      {/* ================================================================ */}
      <section className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="animate-float-slow absolute inset-0 bg-gradient-to-br from-blue-600/10 via-violet-600/5 to-transparent pointer-events-none" />
        <div className="animate-float absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-blue-600/15 blur-[100px] pointer-events-none" style={{ animationDelay: '2s' }} />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center" data-reveal>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-violet-500/30 mb-8 hover:scale-110 transition-transform">
            <Sparkles size={28} className="text-violet-400" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-5 leading-tight">
            Pronto para modernizar<br />seu escritório?
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Acesse agora e tenha controle total da sua operação contábil.
            Seguro, inteligente e com IA integrada.
          </p>
          <Link
            href={usuario ? dashHref : '/login'}
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/50"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
          >
            {dashLabel ?? 'Entrar na plataforma'}
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-slate-600 text-sm mt-6">Sistema self-hosted · LGPD Compliant · Open Source</p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FOOTER                                                             */}
      {/* ================================================================ */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
            <span className="text-slate-600 text-sm hidden sm:block">© {new Date().getFullYear()} · Sistema self-hosted · LGPD Compliant</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-600">
            <a href="/privacidade" className="hover:text-slate-400 transition-colors">Política de Privacidade</a>
            <span>·</span>
            <a href="/termos" className="hover:text-slate-400 transition-colors">Termos de Uso</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
