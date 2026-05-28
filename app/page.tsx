'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  CalendarClock,
  Cloud,
  CreditCard,
  Users,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  FileSignature,
  BarChart3,
  Bell,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../src/presentation/hooks/useAuth';

const ROTA_DEFAULT: Record<string, string> = {
  Contador: '/dashboard',
  Cliente:  '/inicio',
  Admin:    '/dashboard-admin',
};

const FEATURES = [
  {
    icon: <CalendarClock size={28} className="text-blue-500" />,
    titulo: 'Automação Fiscal',
    descricao:
      'Lembretes automáticos de obrigações, geração de relatórios mensais e alertas de boletos. Nunca mais perca um prazo.',
    itens: [
      'Lembretes de obrigações com 7 dias de antecedência',
      'Relatório mensal automático por e-mail',
      'Alertas de boletos vencendo em 3 dias',
      'Geração automática de obrigações recorrentes',
    ],
  },
  {
    icon: <Cloud size={28} className="text-sky-500" />,
    titulo: 'Acesso em Nuvem',
    descricao:
      'Documentos e dados sempre disponíveis, com armazenamento seguro e backups automáticos. Acesse de qualquer lugar.',
    itens: [
      'Armazenamento MinIO (S3-compatível) com URLs temporárias',
      'Bucket privado com versionamento habilitado',
      'Infraestrutura containerizada com Docker',
      'Proxy reverso HTTPS com suporte a WebSocket',
    ],
  },
  {
    icon: <CreditCard size={28} className="text-emerald-500" />,
    titulo: 'Integração Bancária',
    descricao:
      'Emita boletos e cobranças PIX diretamente pela plataforma. Automatize cobranças e receba alertas de inadimplência.',
    itens: [
      'Boletos e PIX QR Code via Asaas API',
      'Cobranças recorrentes e assinaturas',
      'Webhook automático de pagamentos',
      'Estorno e cancelamento integrados',
    ],
  },
  {
    icon: <Users size={28} className="text-violet-500" />,
    titulo: 'Colaboração com o Cliente',
    descricao:
      'Chat em tempo real, assinatura eletrônica e portal exclusivo. Comunicação ágil, sem e-mail vai-e-vem.',
    itens: [
      'Chat em tempo real via WebSocket',
      'Assinatura eletrônica com link de 72h',
      'Portal do cliente para envio de documentos',
      'Notificações em tempo real no painel',
    ],
  },
];

const DIFERENCIAIS = [
  { icon: <ShieldCheck size={16} />, texto: 'LGPD Compliant' },
  { icon: <ShieldCheck size={16} />, texto: '2FA com TOTP' },
  { icon: <ShieldCheck size={16} />, texto: 'Self-hosted' },
  { icon: <ShieldCheck size={16} />, texto: 'Open Source' },
];

export default function LandingPage() {
  const router = useRouter();
  const { usuario, carregando, role } = useAuth();

  // Redireciona usuários já autenticados
  useEffect(() => {
    if (!carregando && usuario && role) {
      router.replace(ROTA_DEFAULT[role] ?? '/dashboard');
    }
  }, [carregando, usuario, role, router]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      {/* ================================================================ */}
      {/* Header                                                             */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Gestão Contábil</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <a href="#funcionalidades" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Funcionalidades</a>
            <a href="#diferenciais" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Diferenciais</a>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Entrar
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Hero                                                               */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
        {/* Grid decorativo */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Plataforma SaaS para Escritórios Contábeis
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Gestão contábil
            <br />
            <span className="text-blue-400">inteligente e colaborativa</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Automatize processos fiscais, colabore com clientes em tempo real e tenha tudo
            na nuvem — seguro, acessível e pronto para o seu escritório.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/40"
            >
              Acessar o sistema
              <ArrowRight size={18} />
            </Link>
            <a
              href="#funcionalidades"
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors border border-white/20"
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Diferenciais rápidos */}
          <div id="diferenciais" className="flex flex-wrap items-center justify-center gap-4 mt-12 text-sm text-slate-400">
            {DIFERENCIAIS.map((d) => (
              <span key={d.texto} className="flex items-center gap-1.5">
                <span className="text-blue-400">{d.icon}</span>
                {d.texto}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Funcionalidades                                                    */}
      {/* ================================================================ */}
      <section id="funcionalidades" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Tudo que seu escritório precisa
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
              Uma plataforma completa, do controle fiscal à comunicação com o cliente.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.titulo}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{f.titulo}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-5">{f.descricao}</p>
                <ul className="space-y-2">
                  {f.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Destaques adicionais                                               */}
      {/* ================================================================ */}
      <section className="py-16 sm:py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: <MessageSquare size={24} className="text-blue-500" />, titulo: 'Chat em Tempo Real', descricao: 'Comunicação direta com cada cliente via WebSocket, com histórico e notificações.' },
              { icon: <FileSignature size={24} className="text-violet-500" />, titulo: 'Assinatura Eletrônica', descricao: 'Solicite assinaturas com link seguro de 72 horas. Rastreamento de IP e data/hora.' },
              { icon: <BarChart3 size={24} className="text-emerald-500" />, titulo: 'Relatórios e Busca', descricao: 'Relatórios exportáveis em PDF/Excel e busca global por documentos, clientes e obrigações.' },
            ].map((item) => (
              <div key={item.titulo} className="flex flex-col items-center gap-3 p-6">
                <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">{item.titulo}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA Final                                                          */}
      {/* ================================================================ */}
      <section className="py-20 sm:py-24 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <Bell size={32} className="mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Pronto para modernizar seu escritório?
          </h2>
          <p className="text-blue-100 text-lg mb-8 leading-relaxed">
            Acesse a plataforma agora e tenha controle total da sua operação contábil.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl transition-colors shadow-lg"
          >
            Entrar na plataforma
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Footer                                                             */}
      {/* ================================================================ */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <Building2 size={12} className="text-white" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Gestão Contábil — Sistema self-hosted · LGPD Compliant
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <a href="/privacidade" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Política de Privacidade</a>
            <span>·</span>
            <a href="/termos" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Termos de Uso</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
