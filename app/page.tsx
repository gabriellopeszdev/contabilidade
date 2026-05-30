'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileSignature,
  Lock,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Zap,
  Cloud,
  Users,
  ChevronRight,
  Star,
} from 'lucide-react';
import { useAuth } from '../src/presentation/hooks/useAuth';
import { FiscoHubLogo } from './components/FiscoHubLogo';

const ROTA_DEFAULT: Record<string, string> = {
  Contador: '/dashboard',
  Cliente:  '/inicio',
  Admin:    '/dashboard-admin',
};

const FEATURES = [
  {
    icon: CalendarClock,
    color: 'from-blue-500 to-blue-600',
    titulo: 'Automação Fiscal',
    descricao: 'Nunca mais perca um prazo. Obrigações, boletos e relatórios gerados e enviados automaticamente.',
    itens: [
      'Lembretes 7 dias antes do vencimento',
      'Relatório mensal automático por e-mail',
      'Alertas de boletos em 3 dias',
      'Geração automática de obrigações recorrentes',
    ],
  },
  {
    icon: Users,
    color: 'from-violet-500 to-violet-600',
    titulo: 'Portal do Cliente',
    descricao: 'Cada cliente tem seu próprio painel para enviar documentos, assinar e se comunicar.',
    itens: [
      'Chat em tempo real via WebSocket',
      'Envio e gestão de documentos',
      'Notificações instantâneas',
      'Histórico completo de interações',
    ],
  },
  {
    icon: CreditCard,
    color: 'from-emerald-500 to-emerald-600',
    titulo: 'Integração Bancária',
    descricao: 'Boletos e PIX QR Code sem sair da plataforma. Cobranças automáticas e alertas de inadimplência.',
    itens: [
      'Boletos e PIX via Asaas API',
      'Cobranças recorrentes e assinaturas',
      'Webhook automático de pagamentos',
      'Estorno e cancelamento integrados',
    ],
  },
  {
    icon: FileSignature,
    color: 'from-amber-500 to-orange-500',
    titulo: 'Assinatura Eletrônica',
    descricao: 'Solicite assinaturas com link seguro de 72h. Rastreamento de IP, data e hora com validade jurídica.',
    itens: [
      'Link seguro com expiração configurável',
      'Registro de IP, data e hora',
      'Notificação por e-mail ao assinar',
      'Dashboard de assinaturas pendentes',
    ],
  },
];

const STEPS = [
  {
    numero: '01',
    titulo: 'Configure seu escritório',
    descricao: 'Cadastre seus clientes, defina as obrigações fiscais e conecte sua conta bancária em minutos.',
  },
  {
    numero: '02',
    titulo: 'Automatize os processos',
    descricao: 'O FiscoHub cuida dos lembretes, relatórios, cobranças e notificações enquanto você foca no que importa.',
  },
  {
    numero: '03',
    titulo: 'Colabore em tempo real',
    descricao: 'Chat, assinaturas e documentos num portal exclusivo para cada cliente. Sem e-mail, sem papel.',
  },
];

const PLANOS_LANDING = [
  {
    nome: 'Básico',
    preco: '89',
    descricao: 'Para escritórios pequenos que estão começando.',
    destaque: false,
    features: [
      { label: 'Até 20 clientes',           incluido: true  },
      { label: '1.000 documentos/mês',       incluido: true  },
      { label: 'Portal do cliente',          incluido: true  },
      { label: 'Chat em tempo real',         incluido: true  },
      { label: 'Calendário fiscal',          incluido: true  },
      { label: 'Cobranças via Asaas',        incluido: true  },
      { label: 'Assinatura eletrônica',      incluido: false },
      { label: 'Relatórios e exportação',    incluido: false },
      { label: 'Gestão de equipe',           incluido: false },
    ],
  },
  {
    nome: 'Pro',
    preco: '189',
    descricao: 'Para escritórios em crescimento com mais recursos.',
    destaque: true,
    features: [
      { label: 'Até 100 clientes',           incluido: true  },
      { label: '5.000 documentos/mês',       incluido: true  },
      { label: 'Portal do cliente',          incluido: true  },
      { label: 'Chat em tempo real',         incluido: true  },
      { label: 'Calendário fiscal',          incluido: true  },
      { label: 'Cobranças via Asaas',        incluido: true  },
      { label: 'Assinatura eletrônica',      incluido: true  },
      { label: 'Relatórios e exportação',    incluido: true  },
      { label: 'Gestão de equipe',           incluido: true  },
    ],
  },
  {
    nome: 'Enterprise',
    preco: '389',
    descricao: 'Clientes e documentos ilimitados. Todos os recursos.',
    destaque: false,
    features: [
      { label: 'Clientes ilimitados',        incluido: true  },
      { label: 'Documentos ilimitados',      incluido: true  },
      { label: 'Portal do cliente',          incluido: true  },
      { label: 'Chat em tempo real',         incluido: true  },
      { label: 'Calendário fiscal',          incluido: true  },
      { label: 'Cobranças via Asaas',        incluido: true  },
      { label: 'Assinatura eletrônica',      incluido: true  },
      { label: 'Relatórios e exportação',    incluido: true  },
      { label: 'Gestão de equipe ilimitada', incluido: true  },
    ],
  },
];

const TRUST = [
  { icon: ShieldCheck, titulo: 'LGPD Compliant',  descricao: 'Dados armazenados em servidor próprio. Sem compartilhamento com terceiros.' },
  { icon: Lock,        titulo: '2FA com TOTP',    descricao: 'Autenticação em dois fatores com app autenticador (Google, Authy, etc.).' },
  { icon: Cloud,       titulo: 'Self-hosted',     descricao: 'Você controla a infraestrutura. Seus dados nunca saem do seu servidor.' },
  { icon: Zap,         titulo: 'Open Source',     descricao: 'Código aberto, auditável e sem vendor lock-in. Customize como quiser.' },
];

/** Hook que observa elementos [data-reveal] e adiciona .revealed ao entrar na viewport */
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
      { threshold: 0.12 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function LandingPage() {
  const router = useRouter();
  const { usuario, carregando, role } = useAuth();
  useRevealOnScroll();

  useEffect(() => {
    if (!carregando && usuario && role) {
      router.replace(ROTA_DEFAULT[role] ?? '/dashboard');
    }
  }, [carregando, usuario, role, router]);

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
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#como-funciona"   className="hover:text-white transition-colors">Como funciona</a>
            <a href="#planos"          className="hover:text-white transition-colors">Planos</a>
            <a href="#seguranca"       className="hover:text-white transition-colors">Segurança</a>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all hover:scale-105 active:scale-95"
          >
            Acessar
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      {/* ================================================================ */}
      {/* HERO                                                               */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden pt-24 pb-20 sm:pt-32 sm:pb-28">

        {/* Blobs com animação flutuante */}
        <div className="animate-float absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
        <div className="animate-float-slow absolute top-20 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[100px] pointer-events-none" />
        <div className="animate-float absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[180px] bg-blue-500/10 blur-[80px] pointer-events-none" style={{ animationDelay: '3s' }} />

        {/* Grid pontilhado */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">

          {/* Badge — entra de cima */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium mb-8"
            style={{ animation: 'fadeInDown 0.6s 0.1s ease both' }}
          >
            <Star size={11} className="fill-blue-400 text-blue-400" />
            Plataforma completa para escritórios contábeis
            <Star size={11} className="fill-blue-400 text-blue-400" />
          </div>

          {/* H1 */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            style={{ animation: 'fadeInUp 0.7s 0.2s ease both' }}
          >
            Seu escritório contábil
            <br />
            {/* Texto gradiente animado */}
            <span
              className="animate-gradient bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #60a5fa, #a78bfa, #34d399, #60a5fa)',
              }}
            >
              no próximo nível
            </span>
          </h1>

          {/* Subtítulo */}
          <p
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ animation: 'fadeInUp 0.7s 0.35s ease both' }}
          >
            Automatize obrigações fiscais, colabore com clientes em tempo real e gerencie
            cobranças — tudo em uma plataforma segura e self-hosted.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
            style={{ animation: 'fadeInUp 0.7s 0.5s ease both' }}
          >
            <Link
              href="/login"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
            >
              Acessar o sistema
              <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#funcionalidades"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all hover:scale-105 active:scale-95"
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Stats strip */}
          <div
            className="inline-flex flex-wrap justify-center gap-px rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-sm"
            style={{ animation: 'scaleIn 0.7s 0.65s ease both' }}
          >
            {[
              { valor: '100%', label: 'LGPD Compliant' },
              { valor: '2FA',  label: 'Autenticação segura' },
              { valor: 'PIX',  label: 'Cobranças integradas' },
              { valor: '72h',  label: 'Assinatura eletrônica' },
            ].map((s, i) => (
              <div key={i} className="px-6 py-4 text-center hover:bg-white/5 transition-colors cursor-default">
                <div className="text-xl font-bold text-white">{s.valor}</div>
                <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                  data-delay={String(i + 1)}
                  className="group rounded-2xl border border-white/8 bg-white/[0.03] p-7 hover:bg-white/[0.06] hover:border-white/15 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
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
            {/* Linha conectora animada */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px overflow-hidden">
              <div
                className="h-full animate-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #3b82f6, transparent)',
                  backgroundSize: '200% auto',
                }}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <div
                  key={step.numero}
                  data-reveal
                  data-delay={String(i + 1)}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative w-20 h-20 mb-6">
                    {/* Anel pulsante */}
                    <div
                      className="absolute inset-0 rounded-2xl border border-blue-500/40 bg-blue-500/10"
                      style={{ animation: `pulse-ring 3s ${i * 0.8}s ease-out infinite` }}
                    />
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
      {/* DESTAQUES ADICIONAIS                                               */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: MessageSquare,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                titulo: 'Chat em Tempo Real',
                descricao: 'Comunicação direta com cada cliente via WebSocket. Histórico completo e notificações instantâneas.',
              },
              {
                icon: BarChart3,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                titulo: 'Relatórios e Busca',
                descricao: 'Exportação em PDF/Excel e busca global por documentos, clientes e obrigações fiscais.',
              },
              {
                icon: FileSignature,
                color: 'text-violet-400',
                bg: 'bg-violet-500/10',
                titulo: 'Assinatura Eletrônica',
                descricao: 'Link seguro de 72h com rastreamento de IP e data/hora. Validade jurídica garantida.',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.titulo}
                  data-reveal
                  data-delay={String(i + 1)}
                  className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-white/15 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={20} className={item.color} />
                  </div>
                  <h3 className="font-bold text-white mb-2">{item.titulo}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.descricao}</p>
                </div>
              );
            })}
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
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Escolha o plano ideal para o seu escritório
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Sem taxa de adesão. Cancele quando quiser. Suporte incluso.
            </p>
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
                    : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Mais popular
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
                      {f.incluido ? (
                        <CheckCircle2 size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <span className="w-[15px] h-[15px] mt-0.5 shrink-0 rounded-full border border-slate-600 inline-flex items-center justify-center">
                          <span className="w-1.5 h-px bg-slate-600 block" />
                        </span>
                      )}
                      <span className={f.incluido ? 'text-slate-300' : 'text-slate-600'}>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/cadastro?plano=${encodeURIComponent(plano.nome)}`}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 ${
                    plano.destaque
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30'
                      : 'border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Contratar
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SEGURANÇA / TRUST                                                  */}
      {/* ================================================================ */}
      <section id="seguranca" className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-emerald-600/8 blur-[80px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16" data-reveal>
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Segurança & Privacidade</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Construído com segurança desde o início
            </h2>
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-8 hover:scale-110 transition-transform">
            <Zap size={28} className="text-blue-400" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-5 leading-tight">
            Pronto para modernizar
            <br />seu escritório?
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Acesse agora e tenha controle total da sua operação contábil.
            Seguro, inteligente e sem mensalidade de plataforma.
          </p>

          <Link
            href="/login"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/50"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
          >
            Entrar na plataforma
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <p className="text-slate-600 text-sm mt-6">
            Sistema self-hosted · LGPD Compliant · Open Source
          </p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FOOTER                                                             */}
      {/* ================================================================ */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
            <span className="text-slate-600 text-sm hidden sm:block">
              © {new Date().getFullYear()} · Sistema self-hosted · LGPD Compliant
            </span>
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
