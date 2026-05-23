'use client';

import { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Upload,
  Download,
  Shield,
  Clock,
  FileText,
  Mail,
  MessageCircle,
} from 'lucide-react';

// =============================================================================
// FAQ Data
// =============================================================================

interface FAQItem {
  pergunta: string;
  resposta: string;
  icone:    React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    pergunta: 'Como envio documentos para o meu contador?',
    resposta:
      'Acesse a página "Enviar Arquivo" no menu lateral. Clique no botão "Enviar Documento", selecione o setor (Fiscal, Pessoal ou Contábil), arraste ou selecione seus arquivos PDF ou XML (até 10 MB cada) e clique em "Enviar". Seu contador será notificado automaticamente em tempo real.',
    icone: <Upload size={18} className="text-blue-500" />,
  },
  {
    pergunta: 'Como baixo os documentos que o contador enviou?',
    resposta:
      'Na página "Meus Documentos", você verá todos os documentos enviados pelo seu contador. Clique no botão de download (ícone de seta para baixo) ao lado do documento desejado. O download será iniciado automaticamente. Documentos novos terão um badge "NOVO" pulsante.',
    icone: <Download size={18} className="text-emerald-500" />,
  },
  {
    pergunta: 'Quais formatos de arquivo são aceitos?',
    resposta:
      'O sistema aceita arquivos nos formatos PDF e XML. Cada arquivo pode ter no máximo 10 MB. Você pode enviar até 50 arquivos por vez. Formatos como Word (.doc/.docx), imagens (.jpg/.png) ou planilhas (.xls/.xlsx) não são aceitos — converta para PDF antes de enviar.',
    icone: <FileText size={18} className="text-violet-500" />,
  },
  {
    pergunta: 'Meus dados estão seguros?',
    resposta:
      'Sim. Todos os dados são armazenados em servidores próprios (self-hosted) com criptografia em trânsito (HTTPS/TLS) e em repouso. As senhas são protegidas com hash scrypt (algoritmo de última geração). O sistema está em conformidade com a LGPD e segue as melhores práticas de segurança OWASP.',
    icone: <Shield size={18} className="text-amber-500" />,
  },
  {
    pergunta: 'Por quanto tempo meus documentos ficam disponíveis?',
    resposta:
      'Os documentos fiscais são retidos por no mínimo 5 anos, conforme exigido pelo Código Tributário Nacional (CTN Art. 173). Isso garante que você sempre tenha acesso ao histórico necessário em caso de fiscalização ou consulta.',
    icone: <Clock size={18} className="text-red-500" />,
  },
  {
    pergunta: 'O que significam os setores (Fiscal, Pessoal, Contábil)?',
    resposta:
      'Os setores organizam seus documentos por área:\n\n• Fiscal — Notas fiscais, guias de impostos (DAS, DARF), declarações tributárias.\n• Pessoal — Folha de pagamento, holerites, FGTS, férias, rescisões.\n• Contábil — Balanços, balancetes, DRE, livros contábeis, contratos.',
    icone: <HelpCircle size={18} className="text-teal-500" />,
  },
  {
    pergunta: 'Recebi uma notificação de novo documento. E agora?',
    resposta:
      'Quando seu contador envia um novo documento, você recebe uma notificação em tempo real (ícone do sininho no canto superior). Acesse "Meus Documentos" para visualizar e baixar. O badge "NOVO" desaparece automaticamente após você baixar o arquivo.',
    icone: <MessageCircle size={18} className="text-pink-500" />,
  },
  {
    pergunta: 'Esqueci minha senha. Como recupero?',
    resposta:
      'Entre em contato diretamente com seu contador. Ele pode redefinir sua senha pelo painel administrativo. Por segurança, a senha padrão inicial é temporária e deve ser alterada no primeiro acesso nas Configurações.',
    icone: <Shield size={18} className="text-gray-500" />,
  },
];

// =============================================================================
// Componente: Accordion Item
// =============================================================================

interface AccordionItemProps {
  item:    FAQItem;
  aberto:  boolean;
  onClick: () => void;
}

function AccordionItem({ item, aberto, onClick }: AccordionItemProps) {
  return (
    <div className={`border rounded-xl transition-all ${aberto ? 'border-sky-200 bg-sky-50/30' : 'border-gray-200 bg-white'}`}>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-5 py-4 text-left focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset rounded-xl"
        aria-expanded={aberto}
      >
        <span className="shrink-0">{item.icone}</span>
        <span className={`flex-1 text-sm font-semibold ${aberto ? 'text-sky-800' : 'text-gray-800'}`}>
          {item.pergunta}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${aberto ? 'rotate-180 text-sky-500' : ''}`}
        />
      </button>

      {aberto && (
        <div className="px-5 pb-4 pl-12">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {item.resposta}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Página: /ajuda — FAQ e Suporte
// =============================================================================

export default function AjudaPage() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-100 mb-4">
          <HelpCircle size={28} className="text-sky-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Central de Ajuda</h1>
        <p className="text-sm text-gray-500 mt-1">
          Encontre respostas para as dúvidas mais frequentes sobre o sistema
        </p>
      </div>

      {/* Accordion de FAQ */}
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem
            key={i}
            item={item}
            aberto={aberto === i}
            onClick={() => setAberto(aberto === i ? null : i)}
          />
        ))}
      </div>

      {/* Card de contato */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 shrink-0">
            <Mail size={20} className="text-sky-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Não encontrou o que procura?</h2>
            <p className="text-sm text-gray-500 mt-1">
              Entre em contato com seu contador diretamente. Ele tem acesso ao painel
              administrativo e pode ajudá-lo com qualquer questão sobre seus documentos,
              prazos ou configurações do sistema.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Horário de atendimento: Segunda a Sexta, 8h às 18h
            </p>
          </div>
        </div>
      </div>

      {/* Versão do sistema */}
      <p className="text-center text-[10px] text-gray-300 mt-6">
        Gestão Contábil v0.1.0 — Self-hosted · LGPD Compliant
      </p>
    </div>
  );
}
