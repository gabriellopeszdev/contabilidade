'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Flag,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface Evento {
  id: string;
  tipo: 'obrigacao' | 'tarefa';
  titulo: string;
  descricao?: string | null;
  data: string;
  cor: string;
  status?: string;
  prioridade?: string;
  clienteNome?: string;
}

interface Obrigacao {
  id: string;
  nome: string;
  descricao: string | null;
  diaVencimento: number;
  cor: string;
  ativo: boolean;
}

interface Toast {
  tipo: 'sucesso' | 'erro';
  msg: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getDiasDoMes(ano: number, mes: number) {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia   = new Date(ano, mes + 1, 0);
  const diasNoMes   = ultimoDia.getDate();
  const iniciaSemana = primeiroDia.getDay();

  const dias: Array<{ dia: number; mesAtual: boolean }> = [];

  const diasMesAnterior = new Date(ano, mes, 0).getDate();
  for (let i = iniciaSemana - 1; i >= 0; i--) {
    dias.push({ dia: diasMesAnterior - i, mesAtual: false });
  }
  for (let d = 1; d <= diasNoMes; d++) {
    dias.push({ dia: d, mesAtual: true });
  }
  while (dias.length % 7 !== 0) {
    dias.push({ dia: dias.length - (iniciaSemana + diasNoMes) + 1, mesAtual: false });
  }

  return dias;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const SETOR_LABEL: Record<string, string> = {
  FISCAL:   'Fiscal',
  PESSOAL:  'Pessoal',
  CONTABIL: 'Contábil',
  TODOS:    'Todos',
};

// =============================================================================
// Página: /(contador)/calendario
// =============================================================================

export default function CalendarioPage() {
  const { token, isDono, isFuncionario, usuario } = useAuth();

  const hoje = useMemo(() => new Date(), []);

  const [mesAtual, setMesAtual] = useState(() => ({
    ano: hoje.getFullYear(),
    mes: hoje.getMonth(),
  }));

  const [eventos,    setEventos]    = useState<Evento[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [toast,      setToast]      = useState<Toast | null>(null);

  // Dia selecionado — começa em hoje
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(hoje.getDate());

  // Modal de nova obrigação
  const [modalAberto,    setModalAberto]    = useState(false);
  const [novaObrigacao,  setNovaObrigacao]  = useState({
    nome: '', descricao: '', diaVencimento: 15, cor: '#3b82f6',
  });
  const [criando, setCriando] = useState(false);

  // Delete inline
  const [confirmandoDeleteId, setConfirmandoDeleteId] = useState<string | null>(null);
  const [deletando,            setDeletando]           = useState(false);

  const mesKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, '0')}`;

  // ---------------------------------------------------------------------------
  // Carregar dados
  // ---------------------------------------------------------------------------
  const carregarDados = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const [evRes, obRes] = await Promise.all([
        fetch(`/api/v1/calendario/eventos?mes=${mesKey}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/calendario/obrigacoes', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (evRes.ok) {
        const evData = await evRes.json();
        setEventos(evData.eventos);
      }
      if (obRes.ok) {
        const obData = await obRes.json();
        setObrigacoes(obData.obrigacoes);
      }
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao carregar calendário.' });
    } finally {
      setCarregando(false);
    }
  }, [token, mesKey]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Auto-limpar toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-cancelar confirmação de delete após 5s sem ação
  useEffect(() => {
    if (!confirmandoDeleteId) return;
    const t = setTimeout(() => setConfirmandoDeleteId(null), 5_000);
    return () => clearTimeout(t);
  }, [confirmandoDeleteId]);

  // ---------------------------------------------------------------------------
  // Derivações
  // ---------------------------------------------------------------------------
  const dias = useMemo(() => getDiasDoMes(mesAtual.ano, mesAtual.mes), [mesAtual]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<number, Evento[]>();
    for (const ev of eventos) {
      const d = new Date(ev.data).getDate();
      if (!mapa.has(d)) mapa.set(d, []);
      mapa.get(d)!.push(ev);
    }
    return mapa;
  }, [eventos]);

  const ehHoje = (dia: number) =>
    dia === hoje.getDate() &&
    mesAtual.mes === hoje.getMonth() &&
    mesAtual.ano === hoje.getFullYear();

  const eventosDoDia = diaSelecionado ? (eventosPorDia.get(diaSelecionado) ?? []) : [];

  const setoresLabel = isFuncionario && usuario?.setores?.length
    ? usuario.setores.map((s) => SETOR_LABEL[s] ?? s).join(', ')
    : null;

  // ---------------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------------
  const mesAnterior = () => {
    setMesAtual((m) => m.mes === 0 ? { ano: m.ano - 1, mes: 11 } : { ...m, mes: m.mes - 1 });
    setDiaSelecionado(null);
  };

  const mesSeguinte = () => {
    setMesAtual((m) => m.mes === 11 ? { ano: m.ano + 1, mes: 0 } : { ...m, mes: m.mes + 1 });
    setDiaSelecionado(null);
  };

  // ---------------------------------------------------------------------------
  // Criar obrigação
  // ---------------------------------------------------------------------------
  const handleCriarObrigacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!novaObrigacao.nome.trim()) {
      setToast({ tipo: 'erro', msg: 'Nome é obrigatório.' });
      return;
    }

    setCriando(true);
    try {
      const res = await fetch('/api/v1/calendario/obrigacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(novaObrigacao),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: data.message ?? 'Erro ao criar.' });
        return;
      }
      setToast({ tipo: 'sucesso', msg: 'Obrigação cadastrada!' });
      setModalAberto(false);
      setNovaObrigacao({ nome: '', descricao: '', diaVencimento: 15, cor: '#3b82f6' });
      carregarDados();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro de conexão.' });
    } finally {
      setCriando(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Deletar obrigação
  // ---------------------------------------------------------------------------
  const handleDeletarObrigacao = async (id: string) => {
    if (!token) return;
    setDeletando(true);
    try {
      const res = await fetch(`/api/v1/calendario/obrigacoes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: data.message ?? 'Erro ao remover.' });
        return;
      }
      setToast({ tipo: 'sucesso', msg: 'Obrigação removida.' });
      setConfirmandoDeleteId(null);
      carregarDados();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro de conexão.' });
    } finally {
      setDeletando(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

      {/* Cabeçalho da página */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendário de Obrigações</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {setoresLabel
              ? <>Seus setores: <span className="font-medium text-gray-700 dark:text-gray-300">{setoresLabel}</span></>
              : 'Vencimentos fiscais e tarefas do escritório'
            }
          </p>
        </div>

        {isDono && (
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-90 transition-colors shrink-0"
          >
            <Plus size={16} />
            Nova Obrigação
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

        {/* ------------------------------------------------------------------ */}
        {/* Calendário mensal                                                    */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          {/* Navegação do mês */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={mesAnterior}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {MESES[mesAtual.mes]} {mesAtual.ano}
            </h2>
            <button
              onClick={mesSeguinte}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {carregando ? (
            <div className="flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Cabeçalho dias da semana */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DIAS_SEMANA.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid de dias */}
              <div className="grid grid-cols-7 gap-1">
                {dias.map((cell, idx) => {
                  const evs       = cell.mesAtual ? (eventosPorDia.get(cell.dia) ?? []) : [];
                  const selecionado = cell.mesAtual && cell.dia === diaSelecionado;
                  const eHoje     = cell.mesAtual && ehHoje(cell.dia);

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!cell.mesAtual}
                      onClick={() => cell.mesAtual && setDiaSelecionado(cell.dia)}
                      className={[
                        'relative h-20 rounded-lg p-1.5 text-left transition-all border',
                        !cell.mesAtual
                          ? 'text-gray-300 dark:text-gray-600 bg-gray-50/50 dark:bg-gray-800/50 border-transparent cursor-default'
                          : !selecionado
                          ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500 ring-1 ring-blue-500 dark:ring-blue-500',
                      ].join(' ')}
                    >
                      {/* Número do dia */}
                      <span
                        className={[
                          'text-xs leading-none',
                          eHoje
                            ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white font-bold'
                            : '',
                        ].join(' ')}
                      >
                        {cell.dia}
                      </span>

                      {/* Mini labels dos eventos */}
                      {evs.length > 0 && (
                        <div className="mt-1 space-y-0.5 overflow-hidden">
                          {evs.slice(0, 2).map((ev) => (
                            <div key={ev.id} className="flex items-center gap-0.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: ev.cor }}
                              />
                              <span className="text-[9px] text-gray-600 dark:text-gray-400 truncate leading-tight">
                                {ev.titulo}
                              </span>
                            </div>
                          ))}
                          {evs.length > 2 && (
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 pl-2">
                              +{evs.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Sidebar                                                              */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-4">

          {/* Detalhes do dia selecionado */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
              {diaSelecionado
                ? `${diaSelecionado} de ${MESES[mesAtual.mes]}${ehHoje(diaSelecionado) ? ' — Hoje' : ''}`
                : 'Selecione um dia'}
            </h3>

            {diaSelecionado && eventosDoDia.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">
                Nenhum evento neste dia
              </p>
            )}

            <div className="space-y-2">
              {eventosDoDia.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: ev.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{ev.titulo}</p>

                    {ev.tipo === 'obrigacao' && (
                      <span className="text-[10px] text-amber-600 font-medium">Obrigação Fiscal</span>
                    )}

                    {ev.tipo === 'tarefa' && (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className={`text-[10px] font-medium ${
                            ev.status === 'DONE'
                              ? 'text-emerald-600'
                              : ev.cor === '#ef4444'
                              ? 'text-red-600'
                              : 'text-primary'
                          }`}
                        >
                          {ev.status === 'DONE'
                            ? 'Concluída'
                            : ev.status === 'PENDING'
                            ? 'Pendente'
                            : ev.status}
                        </span>
                        {ev.clienteNome && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">• {ev.clienteNome}</span>
                        )}
                        {ev.prioridade && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">• {ev.prioridade}</span>
                        )}
                      </div>
                    )}

                    {ev.descricao && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">{ev.descricao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de obrigações */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flag size={14} className="text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Obrigações Cadastradas</h3>
              {obrigacoes.length > 0 && (
                <span className="ml-auto text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full px-1.5 py-0.5 font-medium">
                  {obrigacoes.length}
                </span>
              )}
            </div>

            {obrigacoes.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                {isDono
                  ? 'Nenhuma obrigação. Crie a primeira acima.'
                  : 'Nenhuma obrigação cadastrada.'}
              </p>
            ) : (
              <div className="space-y-2">
                {obrigacoes.map((ob) => (
                  <div
                    key={ob.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ob.cor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{ob.nome}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">Todo dia {ob.diaVencimento}</p>
                    </div>

                    {/* Controles de delete — apenas para dono */}
                    {isDono && (
                      confirmandoDeleteId === ob.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleDeletarObrigacao(ob.id)}
                            disabled={deletando}
                            className="text-[10px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletando ? '...' : 'Sim'}
                          </button>
                          <span className="text-gray-300 dark:text-gray-600 text-xs">|</span>
                          <button
                            onClick={() => setConfirmandoDeleteId(null)}
                            className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmandoDeleteId(ob.id)}
                          title="Remover obrigação"
                          className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Legenda</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                <span className="text-[11px] text-gray-600 dark:text-gray-400">Obrigação Fiscal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                <span className="text-[11px] text-gray-600 dark:text-gray-400">Tarefa Kanban</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span className="text-[11px] text-gray-600 dark:text-gray-400">Urgente (vence em 3 dias, pendente)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Modal — Nova Obrigação (apenas para donos)                             */}
      {/* -------------------------------------------------------------------- */}
      {modalAberto && isDono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Nova Obrigação Fiscal</h3>
              <button
                onClick={() => setModalAberto(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} className="text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCriarObrigacao} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome *</label>
                <input
                  type="text"
                  value={novaObrigacao.nome}
                  onChange={(e) => setNovaObrigacao((o) => ({ ...o, nome: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800"
                  placeholder="Ex: FGTS, DAS, ICMS"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                <input
                  type="text"
                  value={novaObrigacao.descricao}
                  onChange={(e) => setNovaObrigacao((o) => ({ ...o, descricao: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800"
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dia de Vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={novaObrigacao.diaVencimento}
                    onChange={(e) =>
                      setNovaObrigacao((o) => ({ ...o, diaVencimento: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cor</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={novaObrigacao.cor}
                      onChange={(e) => setNovaObrigacao((o) => ({ ...o, cor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{novaObrigacao.cor}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criando}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-90 disabled:opacity-50 transition-colors"
                >
                  {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {criando ? 'Criando…' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Toast                                                                  */}
      {/* -------------------------------------------------------------------- */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
              toast.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              : <AlertCircle  size={18} className="text-red-500 shrink-0" />
            }
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
