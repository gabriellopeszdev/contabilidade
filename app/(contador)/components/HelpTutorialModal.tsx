'use client';

import { useState } from 'react';
import {
  X,
  BookOpen,
  PenLine,
  FileText,
  Upload,
  Users,
  ClipboardList,
  CalendarDays,
  DollarSign,
  Bot,
  Search,
  ChevronRight,
  ChevronLeft,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  UserPlus,
  Shield,
  FileBarChart
} from 'lucide-react';

interface HelpTutorialModalProps {
  aberto: boolean;
  onClose: () => void;
}

type TabId =
  | 'visao-geral'
  | 'nfe-clientes'
  | 'upload-lote'
  | 'clientes-equipe'
  | 'kanban'
  | 'calendario'
  | 'financeiro-relatorios'
  | 'assinaturas'
  | 'chat-ia'
  | 'busca';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

export function HelpTutorialModal({ aberto, onClose }: HelpTutorialModalProps) {
  const [tabAtiva, setTabAtiva] = useState<TabId>('visao-geral');

  if (!aberto) return null;

  const TABS: TabItem[] = [
    { id: 'visao-geral', label: 'Visão Geral & Dashboard', icon: <BookOpen size={16} /> },
    { id: 'nfe-clientes', label: 'NF-e dos Clientes', icon: <FileText size={16} /> },
    { id: 'upload-lote', label: 'Upload em Lote', icon: <Upload size={16} /> },
    { id: 'clientes-equipe', label: 'Clientes & Equipe', icon: <Users size={16} /> },
    { id: 'kanban', label: 'Kanban (Fluxo de Trabalho)', icon: <ClipboardList size={16} /> },
    { id: 'calendario', label: 'Calendário & IA Fiscal', icon: <CalendarDays size={16} /> },
    { id: 'financeiro-relatorios', label: 'Financeiro & Relatórios', icon: <DollarSign size={16} /> },
    { id: 'assinaturas', label: 'Assinaturas Eletrônicas', icon: <PenLine size={16} /> },
    { id: 'chat-ia', label: 'Canais & Chat IA', icon: <Bot size={16} /> },
    { id: 'busca', label: 'Busca Global', icon: <Search size={16} /> },
  ];

  const currentIndex = TABS.findIndex((t) => t.id === tabAtiva);
  const prevTab = currentIndex > 0 ? TABS[currentIndex - 1] : null;
  const nextTab = currentIndex < TABS.length - 1 ? TABS[currentIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-6xl h-[700px] max-h-[95vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-xl">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Guia de Recursos & Central de Ajuda</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Entenda o funcionamento e o fluxo de cada módulo do sistema</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Fechar tutorial"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          
          {/* Sidebar Menu */}
          <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-3 py-3 md:p-4 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-1.5 md:gap-1 md:space-y-0">
            {TABS.map((tab) => {
              const ativa = tabAtiva === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabAtiva(tab.id)}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 p-2.5 md:px-3.5 md:py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                    ativa
                      ? 'bg-primary text-white shadow-md shadow-primary/10'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <span className={`shrink-0 ${ativa ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {tab.icon}
                  </span>
                  <span className="hidden md:inline whitespace-nowrap text-left">{tab.label}</span>
                  {ativa && <ChevronRight size={14} className="ml-auto hidden md:block" />}
                </button>
              );
            })}
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-white dark:bg-gray-900">
            
            {/* 1. VISÃO GERAL & DASHBOARD */}
            {tabAtiva === 'visao-geral' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-primary dark:text-primary bg-primary/10 dark:bg-primary/10 rounded-full">Painel Principal</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Visão Geral & Dashboard</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    O <strong>Dashboard</strong> é o ponto de partida do seu dia a dia. Ele consolida métricas críticas do escritório para que você tenha visibilidade instantânea sem precisar navegar por várias telas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Métricas Consolidadas</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Visualize a quantidade total de clientes ativos, pendências fiscais pendentes, tarefas atrasadas e o volume de notas fiscais importadas no mês corrente.
                    </p>
                  </div>
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Alertas Rápidos</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      O sistema destaca prazos de obrigações fiscais vencendo hoje ou nos próximos dias, ajudando seu escritório a evitar atrasos e multas.
                    </p>
                  </div>
                </div>

                <div className="p-4 border border-primary/20 dark:border-primary/30 bg-primary/10 dark:bg-primary/5 rounded-xl">
                  <h4 className="font-semibold text-gray-950 dark:text-gray-200 text-xs uppercase tracking-wider mb-2">Fluxo do Dashboard</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Sempre que novos XMLs são importados ou tarefas do Kanban mudam de status, o Dashboard recalcula e atualiza as estatísticas em tempo real, permitindo análises precisas da capacidade e entrega do escritório.
                  </p>
                </div>
              </div>
            )}

            {/* 2. NF-E DOS CLIENTES */}
            {tabAtiva === 'nfe-clientes' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full font-mono">Faturamento & XML</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notas Fiscais Eletrônicas (NF-e)</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Este módulo centraliza todas as notas fiscais emitidas (saídas) e recebidas (entradas) pelos seus clientes de forma estruturada, facilitando a apuração de impostos mensais.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/20 dark:bg-gray-800/10">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 h-9 flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Leitura Automatizada de XML</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Ao importar um XML, o processador extrai de forma instantânea a chave de acesso, dados do emitente, do destinatário, valor total da nota, itens, data de emissão e impostos retidos (como PIS, COFINS, CSLL, IR e ISS).
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/20 dark:bg-gray-800/10">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 h-9 flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Visualização de Detalhes</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Em vez de abrir arquivos brutos, você pode visualizar uma ficha limpa e organizada de cada NF-e diretamente na tela, incluindo o cálculo rápido de impostos calculados e informações de envio de guias.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/20">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wider mb-2">Fluxo de Consulta</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Você pode filtrar as notas fiscais por <strong>Cliente</strong>, <strong>Período (Mês/Ano)</strong> ou <strong>Tipo (Entrada/Saída)</strong>, gerando uma tabela unificada para conferência antes do fechamento fiscal.
                  </p>
                </div>
              </div>
            )}

            {/* 3. UPLOAD EM LOTE */}
            {tabAtiva === 'upload-lote' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">Processamento Massivo</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Upload de Documentos em Lote</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Evite o trabalho repetitivo de importar notas fiscais uma por uma. Com o <strong>Upload em Lote</strong>, você envia centenas de XMLs simultaneamente e o sistema faz a triagem.
                  </p>
                </div>

                <div className="p-4 border border-primary/20 dark:border-primary/20 bg-primary/10 dark:bg-primary/5 rounded-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <Upload className="text-primary shrink-0" size={20} />
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Como funciona o fluxo de triagem automática?</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg space-y-1">
                      <span className="font-bold text-primary dark:text-primary">1. Drag & Drop</span>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Você arrasta múltiplos arquivos XML ou ZIP contendo as notas para a área de upload.</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg space-y-1">
                      <span className="font-bold text-primary dark:text-primary">2. Mapeamento por CNPJ</span>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">O sistema abre cada XML, identifica o CNPJ do emitente ou destinatário e o vincula ao cliente correspondente cadastrado no sistema.</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg space-y-1">
                      <span className="font-bold text-primary dark:text-primary">3. Deduplicação</span>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Notas com chaves de acesso já existentes no banco de dados são rejeitadas silenciosamente, impedindo dados duplicados.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex gap-3 items-start">
                  <Info className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <h5 className="font-semibold text-amber-900 dark:text-amber-300 text-xs">Aviso importante para o upload:</h5>
                    <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                      Certifique-se de que os clientes a quem as notas pertencem já estejam previamente cadastrados com o CNPJ correto no sistema, caso contrário, o sistema sinalizará que o XML pertence a um CNPJ não cadastrado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. CLIENTES & EQUIPE */}
            {tabAtiva === 'clientes-equipe' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-full">Gestão Interna</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Controle de Clientes e Equipe</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Organize a carteira de clientes do seu escritório e controle os acessos dos colaboradores para garantir delegação e segurança.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/20 dark:bg-gray-800/10">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                      <Users size={16} className="text-teal-600" />
                      Carteira de Clientes
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Visualize os dados cadastrais (Razão Social, CNPJ, Regime Tributário, CNAE e dados de contato) de cada cliente. A partir daqui você também acessa os prontuários específicos de cada um deles.
                    </p>
                  </div>
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/20 dark:bg-gray-800/10">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                      <UserPlus size={16} className="text-teal-600" />
                      Membros da Equipe
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Gerencie quem trabalha no escritório. Você pode cadastrar colaboradores, gerenciar seus perfis de acesso e ver quais tarefas do Kanban estão associadas a eles.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-primary/10 dark:bg-primary/5 border border-primary/20 rounded-xl flex gap-3 items-start">
                  <Shield className="text-primary shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <h5 className="font-semibold text-gray-900 dark:text-gray-200 text-xs">Hierarquia de Permissões</h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Apenas usuários com a função de <strong>Dono</strong> do escritório podem visualizar o menu de "Equipe", alterar planos ou gerenciar configurações administrativas e financeiras do escritório.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. KANBAN (OPERACIONAL) */}
            {tabAtiva === 'kanban' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-full">Operações</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quadro Kanban</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    O Kanban permite gerenciar tarefas operacionais e rotinas contábeis de maneira visual e intuitiva, melhorando o fluxo de entregas do time.
                  </p>
                </div>

                <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/30 dark:bg-gray-800/10 space-y-3">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wider">Como funciona o fluxo operacional?</h4>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-3 text-gray-600 dark:text-gray-400">
                    <div className="flex-1 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <span className="font-bold text-orange-600 dark:text-orange-400 block mb-1">A Fazer</span>
                      <span>Novas obrigações ou solicitações manuais entram na primeira coluna.</span>
                    </div>
                    <ArrowRight className="hidden sm:block text-gray-300 shrink-0" size={14} />
                    <div className="flex-1 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <span className="font-bold text-orange-600 dark:text-orange-400 block mb-1">Em Progresso</span>
                      <span>Arraste o card ao iniciar a apuração ou a redação de um documento para que a equipe saiba que está sendo feito.</span>
                    </div>
                    <ArrowRight className="hidden sm:block text-gray-300 shrink-0" size={14} />
                    <div className="flex-1 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <span className="font-bold text-orange-600 dark:text-orange-400 block mb-1">Concluído</span>
                      <span>Finalize e arquive o card, disparando automaticamente a atualização dos relatórios de produtividade.</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/10 dark:bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    <strong>Integração com Clientes:</strong> Cada tarefa pode ser associada a um cliente específico e ter um responsável da equipe designado, facilitando a filtragem por cliente ou colaborador dentro do quadro.
                  </p>
                </div>
              </div>
            )}

            {/* 6. CALENDÁRIO & IA FISCAL */}
            {tabAtiva === 'calendario' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-full">Agenda Tributária</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendário de Obrigações</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Monitore os prazos de vencimento de impostos e obrigações acessórias dos seus clientes em uma visão integrada mensal ou semanal.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 items-start p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/30 dark:bg-gray-800/20">
                    <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Gerador Inteligente por CNAE e Regime</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Ao cadastrar ou editar um cliente, você pode acionar a IA para analisar seu Regime Tributário (Simples Nacional, Lucro Real ou Presumido) e código CNAE para gerar toda a grade de obrigações acessórias (DAS, DCTF, EFD) automaticamente para o ano.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/30 dark:bg-gray-800/20">
                    <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Visualização em Lista ou Calendário</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Alterne de forma ágil entre a visualização de calendário convencional (com cores separadas por prioridade) e o formato de lista de obrigações diárias ou mensais.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. FINANCEIRO & RELATÓRIOS */}
            {tabAtiva === 'financeiro-relatorios' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full">Faturamento Interno</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Financeiro & Relatórios</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Gerencie a saúde financeira do seu escritório e gere relatórios estatísticos de produtividade, faturamento dos clientes e obrigações.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/20 dark:bg-gray-800/10">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                      <DollarSign size={16} className="text-amber-600" />
                      Módulo Financeiro
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Monitore as mensalidades recebidas dos clientes, registre despesas operacionais do escritório e controle o fluxo de caixa mensal.
                    </p>
                  </div>
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gray-50/20 dark:bg-gray-800/10">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                      <FileBarChart size={16} className="text-amber-600" />
                      Relatórios Gerenciais
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Gere relatórios estruturados de faturamento de clientes, exporte relatórios consolidados em Excel para contabilidade e apure gráficos de tarefas concluídas no prazo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 8. ASSINATURAS ELETRÔNICAS */}
            {tabAtiva === 'assinaturas' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full font-mono">Assinatura Digital</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Módulo de Assinaturas Eletrônicas</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    A coleta de assinaturas em contratos de honorários, declarações, procurações ou balancetes é totalmente integrada e automatizada com a ZapSign.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 p-4 border border-primary/20 dark:border-primary/30 rounded-xl bg-primary/10 dark:bg-primary/5">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-lg shrink-0 h-9 flex items-center justify-center">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Anexo Automático de Página de Assinatura</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Ao solicitar uma assinatura, o sistema cria e insere uma nova página <strong>"FOLHA DE ASSINATURA"</strong> de forma automática no final do PDF original. A caixa de assinatura do cliente é posicionada lá. Você não precisa gastar tempo abrindo o editor para posicionar os campos de assinatura!
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/10">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0 h-9 flex items-center justify-center">
                      <Sparkles size={18} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Posicionamento Personalizado por Tag (Opcional)</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Se você precisa que a assinatura fique em um ponto muito específico do documento original, basta escrever o texto <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded font-mono text-[11px] font-bold">[[assinatura]]</code> no documento do Word/PDF. O sistema lerá a tag e posicionará o bloco de assinatura exatamente sobre ela.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20 rounded-xl space-y-3">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wider">Como funciona o fluxo?</h4>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-3 text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-primary/10 dark:bg-primary/20 text-primary-dark dark:text-primary rounded-full flex items-center justify-center font-bold">1</span>
                      <span>Você envia o documento do cliente</span>
                    </div>
                    <ArrowRight className="hidden sm:block text-gray-300" size={14} />
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-primary/10 dark:bg-primary/20 text-primary-dark dark:text-primary rounded-full flex items-center justify-center font-bold">2</span>
                      <span>O cliente recebe notificação e assina</span>
                    </div>
                    <ArrowRight className="hidden sm:block text-gray-300" size={14} />
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-primary/10 dark:bg-primary/20 text-primary-dark dark:text-primary rounded-full flex items-center justify-center font-bold">3</span>
                      <span>O documento assinado volta para o sistema</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. CANAIS & CHAT IA */}
            {tabAtiva === 'chat-ia' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-full font-mono">Comunicação e IA</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Canais de Atendimento & Chat IA</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    Este módulo centraliza todas as comunicações do escritório e oferece suporte cognitivo para tirar dúvidas complexas do dia a dia contábil.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 bg-gradient-to-br from-purple-50/20 to-pink-50/20 dark:from-purple-950/5 dark:to-pink-950/5">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                      <Bot size={16} className="text-purple-600 dark:text-purple-400" />
                      Chat IA (Consultoria Fiscal)
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Um assistente inteligente de IA treinado em legislação tributária brasileira. Pergunte sobre regras do Simples Nacional, alíquotas de ICMS substituição tributária, enquadramento de CNAE ou novidades do Imposto de Renda.
                    </p>
                  </div>
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Canais Operacionais (Chat)</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Converse em tempo real com membros da sua equipe ou envie mensagens diretas para os clientes do escritório, mantendo todo o histórico de conversação formalizado e associado ao cadastro do cliente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 10. BUSCA GLOBAL */}
            {tabAtiva === 'busca' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-full">Pesquisa Rápida</span>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Busca Global do Sistema</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                    A ferramenta de <strong>Busca Global</strong> varre toda a base de dados em segundos para encontrar qualquer elemento arquivado, poupando tempo em auditorias e consultas rápidas.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/20 space-y-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Indexação Instantânea de Dados</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Você pode pesquisar por termos como nome parcial do cliente, número do CNPJ, chave de acesso da NF-e, nome de arquivo PDF enviado ou termos presentes no histórico de chat.
                    </p>
                  </div>

                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/20 space-y-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm font-mono">Linha do Tempo Digital (Prontuário)</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Ao clicar em um resultado de busca de cliente, o sistema redireciona você para o prontuário daquele cliente, que exibe a linha do tempo completa de documentos emitidos, mensagens enviadas e tarefas do Kanban.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navegação prev / next */}
            <div className="flex items-center justify-between pt-6 mt-2 border-t border-gray-100 dark:border-gray-800">
              {prevTab ? (
                <button
                  type="button"
                  onClick={() => setTabAtiva(prevTab.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                >
                  <ChevronLeft size={14} />
                  <span className="hidden sm:inline">{prevTab.label}</span>
                  <span className="sm:hidden">Anterior</span>
                </button>
              ) : <span />}

              <span className="text-[11px] text-gray-400 dark:text-gray-600">
                {currentIndex + 1} / {TABS.length}
              </span>

              {nextTab ? (
                <button
                  type="button"
                  onClick={() => setTabAtiva(nextTab.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                >
                  <span className="hidden sm:inline">{nextTab.label}</span>
                  <span className="sm:hidden">Próxima</span>
                  <ChevronRight size={14} />
                </button>
              ) : <span />}
            </div>

          </main>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            FiscoHub — Sistema Integrado de Gestão Contábil
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
