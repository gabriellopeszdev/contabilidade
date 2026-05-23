import Link from 'next/link';
import {
  FileCheck,
  Handshake,
  Monitor,
  UserCog,
  ShieldAlert,
  FileText,
  Copyright,
  AlertTriangle,
  RefreshCw,
  Gavel,
  ArrowLeft,
  Clock,
  Scale,
} from 'lucide-react';

export const metadata = {
  title: 'Termos de Uso',
};

// =============================================================================
// Componentes auxiliares
// =============================================================================

function SectionHeader({ icon, numero, titulo }: { icon: React.ReactNode; numero: string; titulo: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <h2 className="text-base font-bold text-gray-900">
        <span className="text-blue-600">{numero}.</span> {titulo}
      </h2>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-700 leading-relaxed">
      {children}
    </div>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-2" />
      <span>{children}</span>
    </div>
  );
}

// =============================================================================
// Página: /termos — Termos de Uso
// =============================================================================

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Voltar ao sistema
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Gavel size={28} className="text-blue-200" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Termos de Uso
              </h1>
              <p className="text-blue-200 text-sm mt-1">
                Gestão Contábil — Condições de Utilização
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-blue-200">
            <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10">
              <Clock size={12} />
              Atualizado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10">
              <Scale size={12} />
              Código Civil + CDC + LGPD
            </span>
            <Link
              href="/privacidade"
              className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10 hover:bg-white/20 transition-colors"
            >
              <FileText size={12} />
              Ver Política de Privacidade
            </Link>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="space-y-8">

          {/* 1. Aceitação */}
          <section className="space-y-3">
            <SectionHeader icon={<Handshake size={18} className="text-blue-600" />} numero="1" titulo="Aceitação dos Termos" />
            <InfoCard>
              <p>
                Ao acessar e utilizar o sistema <strong>Gestão Contábil</strong>, você concorda com
                estes Termos de Uso e com a nossa{' '}
                <Link href="/privacidade" className="text-blue-600 hover:underline font-medium">
                  Política de Privacidade
                </Link>
                . Caso não concorde, não utilize o sistema.
              </p>
            </InfoCard>
          </section>

          {/* 2. Descrição */}
          <section className="space-y-3">
            <SectionHeader icon={<Monitor size={18} className="text-blue-600" />} numero="2" titulo="Descrição do Serviço" />
            <InfoCard>
              <p>
                O sistema é uma plataforma self-hosted de gestão contábil que permite o upload,
                organização e gerenciamento de documentos fiscais entre escritórios contábeis e
                seus clientes.
              </p>
            </InfoCard>
          </section>

          {/* 3. Cadastro */}
          <section className="space-y-3">
            <SectionHeader icon={<UserCog size={18} className="text-blue-600" />} numero="3" titulo="Cadastro e Conta" />
            <InfoCard>
              <div className="space-y-2">
                <ListItem>Você é responsável pela veracidade dos dados fornecidos no cadastro.</ListItem>
                <ListItem>Suas credenciais de acesso são pessoais e intransferíveis.</ListItem>
                <ListItem>Comunique imediatamente qualquer uso não autorizado da sua conta.</ListItem>
              </div>
            </InfoCard>
          </section>

          {/* 4. Uso Adequado */}
          <section className="space-y-3">
            <SectionHeader icon={<ShieldAlert size={18} className="text-blue-600" />} numero="4" titulo="Uso Adequado" />
            <InfoCard>
              <p className="mb-3">O usuário compromete-se a:</p>
              <ul className="space-y-2">
                {[
                  'Utilizar o sistema apenas para fins de gestão contábil.',
                  'Não enviar arquivos maliciosos, ilícitos ou que violem direitos de terceiros.',
                  'Não tentar acessar documentos ou dados de outros usuários sem autorização.',
                  'Não utilizar meios automatizados para sobrecarga do sistema.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          </section>

          {/* 5. Documentos Fiscais */}
          <section className="space-y-3">
            <SectionHeader icon={<FileCheck size={18} className="text-blue-600" />} numero="5" titulo="Documentos Fiscais" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-12">
              {[
                { emoji: '📋', titulo: 'Responsabilidade', desc: 'Os documentos enviados são de responsabilidade do remetente.' },
                { emoji: '🔐', titulo: 'Integridade', desc: 'Verificação automática via hash SHA-256 para evitar duplicatas.' },
                { emoji: '📅', titulo: 'Retenção Legal', desc: 'Documentos podem ser retidos por 5 anos conforme legislação tributária.' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{item.emoji}</span>
                    <h3 className="text-xs font-bold text-gray-900">{item.titulo}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Propriedade Intelectual */}
          <section className="space-y-3">
            <SectionHeader icon={<Copyright size={18} className="text-blue-600" />} numero="6" titulo="Propriedade Intelectual" />
            <InfoCard>
              <p>
                O sistema, incluindo sua interface, código-fonte e documentação, é protegido pela
                legislação de propriedade intelectual. O uso do sistema <strong>não transfere nenhum
                direito de propriedade</strong> ao usuário.
              </p>
            </InfoCard>
          </section>

          {/* 7. Limitação */}
          <section className="space-y-3">
            <SectionHeader icon={<AlertTriangle size={18} className="text-blue-600" />} numero="7" titulo="Limitação de Responsabilidade" />
            <div className="pl-12">
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  O sistema é fornecido <strong>&quot;como está&quot;</strong>. Não garantimos disponibilidade
                  ininterrupta. Não nos responsabilizamos por perdas decorrentes de uso inadequado,
                  falhas de infraestrutura externa ou ações de terceiros.
                </p>
              </div>
            </div>
          </section>

          {/* 8. Modificações */}
          <section className="space-y-3">
            <SectionHeader icon={<RefreshCw size={18} className="text-blue-600" />} numero="8" titulo="Modificações" />
            <InfoCard>
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações
                significativas serão comunicadas através do sistema, e um <strong>novo consentimento
                poderá ser solicitado</strong>.
              </p>
            </InfoCard>
          </section>

          {/* 9. Legislação */}
          <section className="space-y-3">
            <SectionHeader icon={<Gavel size={18} className="text-blue-600" />} numero="9" titulo="Legislação Aplicável" />
            <InfoCard>
              <p>
                Estes termos são regidos pela legislação brasileira, em especial pelo{' '}
                <strong>Código Civil</strong>, <strong>Código de Defesa do Consumidor</strong> e{' '}
                <strong>Lei Geral de Proteção de Dados (LGPD)</strong>.
              </p>
            </InfoCard>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao sistema
          </Link>
          <Link
            href="/privacidade"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Política de Privacidade →
          </Link>
        </div>
      </div>
    </div>
  );
}
