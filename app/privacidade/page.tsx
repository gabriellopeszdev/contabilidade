import Link from 'next/link';
import {
  Shield,
  Database,
  Scale,
  Lock,
  Users,
  UserCheck,
  Clock,
  Mail,
  ArrowLeft,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidade',
};

// =============================================================================
// Componentes auxiliares
// =============================================================================

function SectionHeader({ icon, numero, titulo }: { icon: React.ReactNode; numero: string; titulo: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <h2 className="text-base font-bold text-gray-900">
        <span className="text-violet-600">{numero}.</span> {titulo}
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

// =============================================================================
// Página: /privacidade — Política de Privacidade (LGPD)
// =============================================================================

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-violet-200 hover:text-white text-sm transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Voltar ao sistema
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <ShieldCheck size={28} className="text-violet-200" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Política de Privacidade
              </h1>
              <p className="text-violet-200 text-sm mt-1">
                FiscoHub — Conformidade LGPD
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-violet-200">
            <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10">
              <Clock size={12} />
              Atualizado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10">
              <Scale size={12} />
              Lei nº 13.709/2018
            </span>
            <Link
              href="/termos"
              className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10 hover:bg-white/20 transition-colors"
            >
              <FileText size={12} />
              Ver Termos de Uso
            </Link>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="space-y-8">

          {/* 1. Introdução */}
          <section className="space-y-3">
            <SectionHeader icon={<Shield size={18} className="text-violet-600" />} numero="1" titulo="Introdução" />
            <InfoCard>
              <p>
                Esta Política de Privacidade descreve como o sistema <strong>FiscoHub</strong>{' '}
                coleta, utiliza, armazena e protege os dados pessoais dos seus usuários, em
                conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)</strong>.
              </p>
              <p className="mt-3 text-gray-500 text-xs">
                Ao utilizar nossos serviços, você confirma que leu e entendeu esta política.
              </p>
            </InfoCard>
          </section>

          {/* 2. Dados Coletados */}
          <section className="space-y-3">
            <SectionHeader icon={<Database size={18} className="text-violet-600" />} numero="2" titulo="Dados Coletados" />
            <p className="text-sm text-gray-600 pl-12">
              Coletamos os seguintes dados pessoais estritamente necessários para a prestação do serviço:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Users size={13} className="text-sky-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Usuários Clientes</h3>
                </div>
                <p className="text-xs text-gray-500">Nome, e-mail, CNPJ, telefone (opcional)</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <UserCheck size={13} className="text-emerald-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Usuários Contadores</h3>
                </div>
                <p className="text-xs text-gray-500">Nome, e-mail, CRC, telefone (opcional)</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Lock size={13} className="text-amber-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Dados de Acesso</h3>
                </div>
                <p className="text-xs text-gray-500">IP, user-agent, data/hora de login e ações</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                    <FileText size={13} className="text-violet-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Documentos Fiscais</h3>
                </div>
                <p className="text-xs text-gray-500">Arquivos XML e PDF enviados para gestão</p>
              </div>
            </div>
          </section>

          {/* 3. Finalidade */}
          <section className="space-y-3">
            <SectionHeader icon={<Scale size={18} className="text-violet-600" />} numero="3" titulo="Finalidade do Tratamento" />
            <InfoCard>
              <p className="mb-3">Os dados são tratados exclusivamente para:</p>
              <ul className="space-y-2">
                {[
                  'Gestão e organização de documentos fiscais entre contadores e clientes.',
                  'Autenticação e controle de acesso ao sistema.',
                  'Registro de auditoria para segurança e transparência (audit logs).',
                  'Comunicação sobre atividades relacionadas aos documentos.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          </section>

          {/* 4. Base Legal */}
          <section className="space-y-3">
            <SectionHeader icon={<Scale size={18} className="text-violet-600" />} numero="4" titulo="Base Legal" />
            <InfoCard>
              <p>
                O tratamento dos dados se fundamenta no <strong>consentimento do titular</strong> (Art. 7º, I, LGPD),
                na <strong>execução de contrato</strong> (Art. 7º, V) e no <strong>cumprimento de obrigação
                legal ou regulatória</strong> (Art. 7º, II) — especialmente no que se refere à guarda de documentos
                fiscais conforme o Código Tributário Nacional (Art. 173, CTN).
              </p>
            </InfoCard>
          </section>

          {/* 5. Segurança */}
          <section className="space-y-3">
            <SectionHeader icon={<Lock size={18} className="text-violet-600" />} numero="5" titulo="Armazenamento e Segurança" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
              {[
                { emoji: '🔒', titulo: 'Criptografia TLS', desc: 'Documentos armazenados em servidor próprio com criptografia em trânsito.' },
                { emoji: '🆔', titulo: 'UUID Privativo', desc: 'Nomes de arquivos substituídos por identificadores UUID para privacidade.' },
                { emoji: '🛡️', titulo: 'Hash Scrypt', desc: 'Senhas armazenadas com hash criptográfico unidirecional irreversível.' },
                { emoji: '🔐', titulo: 'Acesso Restrito', desc: 'Documentos acessíveis apenas pelo titular e contadores vinculados.' },
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

          {/* 6. Compartilhamento */}
          <section className="space-y-3">
            <SectionHeader icon={<Users size={18} className="text-violet-600" />} numero="6" titulo="Compartilhamento de Dados" />
            <div className="pl-12">
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 flex items-start gap-3">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800">
                  <strong>Não compartilhamos</strong> dados pessoais com terceiros, exceto quando exigido
                  por obrigação legal, regulatória ou ordem judicial.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Direitos */}
          <section className="space-y-3">
            <SectionHeader icon={<UserCheck size={18} className="text-violet-600" />} numero="7" titulo="Direitos do Titular" />
            <InfoCard>
              <p className="mb-3">Conforme a LGPD, você tem direito a:</p>
              <div className="space-y-2">
                {[
                  'Acessar seus dados pessoais armazenados no sistema.',
                  'Corrigir dados incompletos, inexatos ou desatualizados.',
                  'Solicitar a exclusão da conta e anonimização dos dados pessoais.',
                  'Consultar o histórico de acessos e atividades na sua conta (audit log).',
                  'Revogar o consentimento a qualquer momento.',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-2" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-500 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100">
                Estes direitos podem ser exercidos através da seção <strong>&quot;Privacidade&quot;</strong> nas
                configurações da sua conta.
              </p>
            </InfoCard>
          </section>

          {/* 8. Retenção */}
          <section className="space-y-3">
            <SectionHeader icon={<Clock size={18} className="text-violet-600" />} numero="8" titulo="Retenção de Dados" />
            <div className="pl-12">
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 flex items-start gap-3">
                <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p>
                    Documentos fiscais podem ser retidos pelo prazo legal de <strong>5 (cinco) anos</strong> conforme o
                    Art. 173 do Código Tributário Nacional, mesmo após solicitação de exclusão de conta.
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    Dados pessoais são anonimizados imediatamente após a exclusão.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 9. Contato */}
          <section className="space-y-3">
            <SectionHeader icon={<Mail size={18} className="text-violet-600" />} numero="9" titulo="Contato" />
            <InfoCard>
              <p>
                Para dúvidas sobre esta política ou exercício de direitos, entre em contato
                com o Encarregado de Proteção de Dados (DPO) pelo e-mail disponibilizado
                pelo administrador do sistema.
              </p>
            </InfoCard>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao sistema
          </Link>
          <Link
            href="/termos"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Termos de Uso →
          </Link>
        </div>
      </div>
    </div>
  );
}
