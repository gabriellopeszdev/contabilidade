'use client';

import { useState } from 'react';
import {
  X,
  BookOpen,
  FileText,
  Upload,
  PenLine,
  DollarSign,
  MessageSquare,
  Users,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2
} from 'lucide-react';

interface ClientHelpTutorialModalProps {
  aberto: boolean;
  onClose: () => void;
}

type TabId =
  | 'visao-geral'
  | 'meus-documentos'
  | 'enviar-arquivo'
  | 'assinaturas'
  | 'financeiro'
  | 'chat'
  | 'minha-equipe';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

export function ClientHelpTutorialModal({ aberto, onClose }: ClientHelpTutorialModalProps) {
  const [tabAtiva, setTabAtiva] = useState<TabId>('visao-geral');

  if (!aberto) return null;

  const TABS: TabItem[] = [
    { id: 'visao-geral', label: 'Início & Visão Geral', icon: <BookOpen size={16} /> },
    { id: 'meus-documentos', label: 'Meus Documentos', icon: <FileText size={16} /> },
    { id: 'enviar-arquivo', label: 'Enviar Arquivo', icon: <Upload size={16} /> },
    { id: 'assinaturas', label: 'Assinaturas Eletrônicas', icon: <PenLine size={16} /> },
    { id: 'financeiro', label: 'Financeiro (Faturas)', icon: <DollarSign size={16} /> },
    { id: 'chat', label: 'Chat de Suporte', icon: <MessageSquare size={16} /> },
    { id: 'minha-equipe', label: 'Minha Equipe', icon: <Users size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-6xl h-[650px] max-h-[92vh] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-xl">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Portal do Cliente — Manual de Ajuda</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Entenda de forma rápida como interagir com o seu escritório contábil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Fechar ajuda"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          
          {/* Sidebar Menu */}
          <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 bg-primary/5 dark:bg-gray-900/50 p-4 space-y-1 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-2 md:gap-0">
            {TABS.map((tab) => {
              const ativa = tabAtiva === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabAtiva(tab.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 md:shrink-1 ${
                    ativa
                      ? 'bg-primary text-white shadow-md shadow-primary/10'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-primary/10 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <span className={`shrink-0 ${ativa ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {tab.icon}
                  </span>
                  <span className="whitespace-nowrap md:whitespace-normal text-left">{tab.label}</span>
                  {ativa && <ChevronRight size={14} className="ml-auto hidden md:block" />}
                </button>
              );
            })}
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-white dark:bg-gray-900">
            
            {/* 1. VISÃO GERAL */}
            {tabAtiva === 'visao-geral' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-primary dark:text-primary bg-primary/10 dark:bg-primary/10 rounded-full">Boas-vindas</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seu canal direto com a contabilidade</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Este portal foi criado para dar total transparência e agilidade à relação com o seu escritório contábil. Por meio deste canal, você pode baixar suas guias de impostos, assinar documentos eletronicamente com validade jurídica, enviar comprovantes e XMLs, e conversar com seu contador em tempo real.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-primary/20 dark:border-gray-800 rounded-xl space-y-2 bg-primary/5 dark:bg-gray-800/30">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Central de Avisos</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Na página inicial, você acompanha avisos urgentes deixados pela contabilidade e notificações de novas guias prontas para pagamento.
                    </p>
                  </div>
                  <div className="p-4 border border-primary/20 dark:border-gray-800 rounded-xl space-y-2 bg-primary/5 dark:bg-gray-800/30">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Acesso a Prazos</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Fique de olho na lista de tarefas e documentos pendentes para manter a conformidade da sua empresa em dia.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                  <Info className="text-amber-500 shrink-0" size={18} />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    <strong>Informação:</strong> Caso precise tirar dúvidas adicionais sobre legislação, impostos ou taxas, use o menu <strong>Chat</strong> para falar com o seu contador.
                  </p>
                </div>
              </div>
            )}

            {/* 2. MEUS DOCUMENTOS */}
            {tabAtiva === 'meus-documentos' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-primary dark:text-primary bg-primary/10 dark:bg-primary/10 rounded-full">Download de Guias</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Acesso a Guias e Relatórios</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    No menu <strong>Meus Documentos</strong>, você encontra todas as guias de impostos, folhas de pagamento, relatórios contábeis e demonstrativos financeiros que a contabilidade preparou para sua empresa.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/20 dark:bg-gray-800/10">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-lg shrink-0 h-9 flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Divisão por Setores</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Os arquivos são organizados de forma clara em três setores:
                        <br />• <strong>Fiscal:</strong> Guias de DAS, DARF, guias de ICMS, etc.
                        <br />• <strong>Pessoal:</strong> Folha de pagamento, pró-labore, guias de FGTS, etc.
                        <br />• <strong>Contábil:</strong> Contratos, balancetes de conferência, DRE, etc.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/20 dark:bg-gray-800/10">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-lg shrink-0 h-9 flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Alerta de Novos Documentos</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Documentos recém-postados pelo seu contador exibirão uma etiqueta animada <strong>"NOVO"</strong> ao lado do nome. A etiqueta desaparece automaticamente após você efetuar o download do arquivo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ENVIAR ARQUIVO */}
            {tabAtiva === 'enviar-arquivo' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-primary dark:text-primary bg-primary/10 dark:bg-primary/10 rounded-full">Envio de Arquivos</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Como enviar arquivos ao contador</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Sempre que precisar enviar extratos bancários, XMLs de notas que não foram emitidas pelo sistema, contratos assinados ou outros arquivos de suporte, você usará o menu <strong>Enviar Arquivo</strong>.
                  </p>
                </div>

                <div className="p-4 border border-primary/20 dark:border-primary/30 rounded-xl bg-primary/5 dark:bg-primary/10 space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Instruções de Envio</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg space-y-1">
                      <span className="font-bold text-primary dark:text-primary">1. Formatos Aceitos</span>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">O sistema aceita exclusivamente arquivos <strong>PDF</strong> e <strong>XML</strong>.</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg space-y-1">
                      <span className="font-bold text-primary dark:text-primary">2. Limites de Tamanho</span>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Cada arquivo individual deve ter no máximo <strong>10 Megabytes (MB)</strong>.</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg space-y-1">
                      <span className="font-bold text-primary dark:text-primary">3. Classificação Automática</span>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Seus envios caem em uma caixa de entrada do contador, que é notificado e realiza a organização deles.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. ASSINATURAS ELETRÔNICAS */}
            {tabAtiva === 'assinaturas' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full font-mono">Validade Jurídica</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assinaturas de Documentos</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    O escritório utiliza um mecanismo integrado e seguro de assinatura eletrônica. Quando o seu contador solicita uma assinatura, o processo é extremamente simples.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 p-4 border border-emerald-100 dark:border-emerald-900/30 rounded-xl bg-emerald-50/20 dark:bg-emerald-950/10">
                    <span className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Folha de Assinatura Automática</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Ao abrir o documento para assinar, você notará uma folha adicional anexada ao final chamada <strong>"FOLHA DE ASSINATURA"</strong>. O campo onde você vai assinar fica lá por padrão, preservando o layout original do seu documento.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 border border-emerald-100 dark:border-emerald-900/30 rounded-xl bg-emerald-50/20 dark:bg-emerald-950/10">
                    <span className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Assinatura Rápida em Um Clique</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Você clica em "Assinar", insere os dados de confirmação exigidos (como código recebido por e-mail ou SMS, se configurado) e confirma. O documento assinado e o comprovante são arquivados automaticamente na pasta do contador e da sua empresa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. FINANCEIRO */}
            {tabAtiva === 'financeiro' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full">Mensalidades</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Histórico de Faturamento & Boletos</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    No menu <strong>Financeiro</strong>, você gerencia os honorários cobrados pela contabilidade da sua empresa de forma clara e descomplicada.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/20 dark:bg-gray-800/10">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Download de Boletos</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Visualize a lista de boletos emitidos pela contabilidade, verifique as datas de vencimento, valores e baixe o arquivo do boleto ou copie a linha digitável para pagamento no seu banco.
                    </p>
                  </div>
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/20 dark:bg-gray-800/10">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Status de Pagamento</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Acompanhe o status de cada cobrança (Pendente, Paga ou Vencida) e evite a suspensão dos serviços contábeis devido a esquecimento.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. CHAT DE SUPORTE */}
            {tabAtiva === 'chat' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-full">Canais</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fale com seu Contador</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    A comunicação interna do escritório está integrada no portal, garantindo que suas solicitações fiquem seguras e centralizadas, sem depender de e-mails ou aplicativos de chat de terceiros.
                  </p>
                </div>

                <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/30 dark:bg-gray-800/10 space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Histórico de Atendimento</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Você pode trocar mensagens, tirar dúvidas tributárias ou financeiras diretamente com o contador responsável pela sua conta. O histórico das conversas permanece vinculado à sua empresa, facilitando consultas futuras.
                  </p>
                </div>
              </div>
            )}

            {/* 7. MINHA EQUIPE */}
            {tabAtiva === 'minha-equipe' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-full">Membros</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestão de Colaboradores da Empresa</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Se você é o proprietário ou administrador da conta da empresa, você pode autorizar outros sócios ou funcionários a acessarem o portal.
                  </p>
                </div>

                <div className="p-4 border border-primary/20 dark:border-gray-800 rounded-xl bg-primary/5 dark:bg-primary/10 space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Adicionando Colaboradores</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    No menu <strong>Minha Equipe</strong>, você pode cadastrar o e-mail de colaboradores da sua empresa e definir suas senhas. Eles terão acesso ao portal para enviar notas fiscais, baixar contracheques ou acompanhar o financeiro, conforme as necessidades operacionais da sua empresa.
                  </p>
                </div>
              </div>
            )}

          </main>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-primary/10 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            FiscoHub — Portal do Cliente
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg shadow transition-colors"
          >
            Entendido, fechar
          </button>
        </div>

      </div>
    </div>
  );
}
