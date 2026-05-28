'use client';

import { useEffect } from 'react';
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
    bg: 'bg-blue-500/10',
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
    bg: 'bg-violet-500/10',
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
    bg: 'bg-emerald-500/10',
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
    bg: 'bg-amber-500/10',
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

const TRUST = [
  { icon: ShieldCheck, titulo: 'LGPD Compliant', descricao: 'Dados armazenados em servidor próprio. Sem compartilhamento com terceiros.' },
  { icon: Lock,        titulo: '2FA com TOTP',   descricao: 'Autenticação em dois fatores com app autenticador (Google, Authy, etc.).' },
  { icon: Cloud,       titulo: 'Self-hosted',    descricao: 'Você controla a infraestrutura. Seus dados nunca saem do seu servidor.' },
  { icon: Zap,         titulo: 'Open Source',    descricao: 'Código aberto, auditável e sem vendor lock-in. Customize como quiser.' },
];

export default function LandingPage() {
  const router = useRouter();
  const { usuario, carregando, role } = useAuth();

  useEffect(() => {
    if (!carregando && usuario && role) {
      router.replace(ROTA_DEFAULT[role] ?? '/dashboard');
    }
  }, [carregando, usuario, role, router]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white antialiased">

      {/* ================================================================ */}
      {/* HEADER                                                             */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <FiscoHubLogo size="sm" className="[&_span]:!text-white" />

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#como-funciona"   className="hover:text-white transition-colors">Como funciona</a>
            <a href="#seguranca"       className="hover:text-white transition-colors">Segurança</a>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
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

        {/* Blobs decorativos */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-blue-500/10 blur-[80px] pointer-events-none" />

        {/* Grid pontilhado sutil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium mb-8">
            <Star size={11} className="fill-blue-400 text-blue-400" />
            Plataforma completa para escritórios contábeis
            <Star size={11} className="fill-blue-400 text-blue-400" />
          </div>

          {/* H1 */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            Seu escritório contábil
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%)' }}
            >
              no próximo nível
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Automatize obrigações fiscais, colabore com clientes em tempo real e gerencie
            cobranças — tudo em uma plataforma segura e self-hosted.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link
              href="/login"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white transition-all shadow-lg shadow-blue-600/30"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
            >
              Acessar o sistema
              <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#funcionalidades"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Stats strip */}
          <div className="inline-flex flex-wrap justify-center gap-px rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-sm">
            {[
              { valor: '100%', label: 'LGPD Compliant' },
              { valor: '2FA',  label: 'Autenticação segura' },
              { valor: 'PIX',  label: 'Cobranças integradas' },
              { valor: '72h',  label: 'Assinatura eletrônica' },
            ].map((s, i) => (
              <div key={i} className="px-6 py-4 text-center">
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
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Tudo que seu escritório precisa
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Uma plataforma integrada — do lançamento fiscal à assinatura do cliente.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.titulo}
                  className="group relative rounded-2xl border border-white/8 bg-white/[0.03] p-7 hover:bg-white/[0.06] hover:border-white/15 transition-all duration-300"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg`}>
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
          <div className="text-center mb-16">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Processo</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simples de começar, poderoso para crescer
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Três passos para transformar a operação do seu escritório.
            </p>
          </div>

          <div className="relative">
            {/* Linha conectora */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-blue-600/0 via-blue-600/50 to-blue-600/0" />

            <div className="grid sm:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.numero} className="relative flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-center mb-6 relative z-10">
                    <span className="text-2xl font-bold text-blue-400">{step.numero}</span>
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
      {/* DESTAQUES ADICIONAIS — Bento grid                                 */}
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
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.titulo}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:bg-white/[0.05] hover:border-white/12 transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-4`}>
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
      {/* SEGURANÇA / TRUST                                                  */}
      {/* ================================================================ */}
      <section id="seguranca" className="py-24 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-blue-600/10 blur-[80px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Segurança & Privacidade</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Construído com segurança desde o início
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Self-hosted, LGPD compliant e com autenticação de dois fatores. Seus dados, suas regras.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.titulo}
                  className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-6 hover:bg-emerald-500/8 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-4">
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-violet-600/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-blue-600/15 blur-[100px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-8">
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
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
          >
            Entrar na plataforma
            <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
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
