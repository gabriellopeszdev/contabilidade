'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Pencil,
  ShieldCheck,
  FileText,
  Globe,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { validarEmail, validarTelefone, mascararTelefone } from '../../../src/utils/validators';

// =============================================================================
// Tipos
// =============================================================================

interface Membro {
  id:        string;
  name:      string;
  email:     string;
  phone:     string | null;
  setores:   string[];
  isActive:  boolean;
  createdAt: string;
}

const SETORES_OPCOES = [
  { value: 'TODOS',    label: 'Todos',    icon: <Globe size={14} />       },
  { value: 'FISCAL',   label: 'Fiscal',   icon: <FileText size={14} />   },
  { value: 'PESSOAL',  label: 'Pessoal',  icon: <Users size={14} />      },
  { value: 'CONTABIL', label: 'Contábil', icon: <ShieldCheck size={14} /> },
];

const SETOR_CORES: Record<string, string> = {
  TODOS:    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  FISCAL:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  PESSOAL:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  CONTABIL: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};

// =============================================================================
// Página
// =============================================================================

export default function EquipeClientePage() {
  const { token } = useAuth();

  const [membros,      setMembros]      = useState<Membro[]>([]);
  const [carregando,   setCarregando]   = useState(true);
  const [modalAberto,  setModalAberto]  = useState(false);
  const [editando,     setEditando]     = useState<Membro | null>(null);
  const [removendoId,  setRemovendoId]  = useState<string | null>(null);
  const [sucesso,      setSucesso]      = useState<string | null>(null);
  const [erroGlobal,   setErroGlobal]   = useState<string | null>(null);

  // Campos do formulário
  const [nome,       setNome]       = useState('');
  const [email,      setEmail]      = useState('');
  const [senha,      setSenha]      = useState('');
  const [telefone,   setTelefone]   = useState('');
  const [setores,    setSetoresF]   = useState<string[]>([]);
  const [ativoModal, setAtivoModal] = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [erroForm,   setErroForm]   = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Carregar membros
  // ---------------------------------------------------------------------------
  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const res = await fetch('/api/v1/cliente/equipe', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { funcionarios: Membro[] };
      setMembros(data.funcionarios);
    } catch {
      setErroGlobal('Erro ao carregar equipe.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  // Esconder toast de sucesso após 3s
  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => setSucesso(null), 3000);
    return () => clearTimeout(t);
  }, [sucesso]);

  // ---------------------------------------------------------------------------
  // Abrir / fechar modal
  // ---------------------------------------------------------------------------
  function abrirCriar() {
    setEditando(null);
    setNome(''); setEmail(''); setSenha(''); setTelefone(''); setSetoresF([]); setAtivoModal(true);
    setErroForm(null);
    setModalAberto(true);
  }

  function abrirEditar(m: Membro) {
    setEditando(m);
    setNome(m.name); setEmail(m.email); setSenha(''); setTelefone(m.phone ?? '');
    setSetoresF(m.setores); setAtivoModal(m.isActive);
    setErroForm(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
  }

  // ---------------------------------------------------------------------------
  // Toggle setor
  // ---------------------------------------------------------------------------
  function toggleSetor(valor: string) {
    setSetoresF((prev) => {
      if (valor === 'TODOS') {
        // TODOS marca/desmarca exclusivamente — limpa os individuais
        return prev.includes('TODOS') ? [] : ['TODOS'];
      }
      // Setor individual selecionado — remove TODOS se estiver ativo
      const semTodos = prev.filter((s) => s !== 'TODOS');
      return semTodos.includes(valor)
        ? semTodos.filter((s) => s !== valor)
        : [...semTodos, valor];
    });
  }

  // ---------------------------------------------------------------------------
  // Salvar (criar ou editar)
  // ---------------------------------------------------------------------------
  async function handleSalvar() {
    if (!token) return;
    setErroForm(null);

    if (!nome.trim()) { setErroForm('Nome é obrigatório.'); return; }
    if (!editando && !email.trim()) { setErroForm('E-mail é obrigatório.'); return; }
    if (!editando && !validarEmail(email)) { setErroForm('E-mail inválido.'); return; }
    if (!editando && !senha) { setErroForm('Senha é obrigatória.'); return; }
    if (!editando && senha.length < 8) { setErroForm('Senha deve ter pelo menos 8 caracteres.'); return; }
    if (telefone.trim() && !validarTelefone(telefone)) { setErroForm('Telefone inválido. Use o formato (11) 91234-5678.'); return; }
    if (setores.length === 0) { setErroForm('Selecione pelo menos um setor.'); return; }

    setSalvando(true);
    try {
      const url    = editando ? `/api/v1/cliente/equipe/${editando.id}` : '/api/v1/cliente/equipe';
      const method = editando ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = { name: nome.trim(), phone: telefone.trim() || null, setores };
      if (!editando) { body.email = email.trim().toLowerCase(); body.senha = senha; }
      if (editando)  { body.isActive = ativoModal; }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({})) as { message?: string; funcionario?: Membro };

      if (!res.ok) { setErroForm(data.message ?? 'Erro ao salvar.'); return; }

      setSucesso(editando ? 'Membro atualizado!' : 'Membro cadastrado com sucesso!');
      fecharModal();
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Remover
  // ---------------------------------------------------------------------------
  async function handleRemover(id: string) {
    if (!token || !confirm('Remover este membro da equipe?')) return;
    setRemovendoId(id);
    try {
      const res = await fetch(`/api/v1/cliente/equipe/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { message?: string }; alert(d.message ?? 'Erro ao remover.'); return; }
      setSucesso('Membro removido.');
      carregar();
    } finally {
      setRemovendoId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users size={20} className="text-sky-500" />
            Minha Equipe
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Gerencie quem da sua empresa pode acessar o portal
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold
            rounded-xl transition-colors shadow-sm"
        >
          <Plus size={16} />
          Adicionar membro
        </button>
      </div>

      {/* Toast de sucesso */}
      {sucesso && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20
          border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} className="shrink-0" />
          {sucesso}
        </div>
      )}

      {/* Erro global */}
      {erroGlobal && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20
          border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          {erroGlobal}
        </div>
      )}

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando equipe…</span>
        </div>
      ) : membros.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700
          shadow-sm p-14 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center">
            <Users size={26} className="text-sky-400" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Nenhum membro cadastrado</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
            Adicione membros da sua equipe para que eles possam acessar o portal e enviar documentos.
          </p>
          <button
            onClick={abrirCriar}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700
              text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} />
            Adicionar primeiro membro
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

          {/* Header da tabela */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_200px_80px_100px] gap-4 px-6 py-3
            border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800
            text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <span>Membro</span>
            <span>Setores</span>
            <span>Status</span>
            <span className="text-center">Ações</span>
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {membros.map((m) => {
              const iniciais = m.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
              return (
                <li key={m.id} className="lg:grid lg:grid-cols-[1fr_200px_80px_100px] gap-4 items-center
                  px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">

                  {/* Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/40
                      text-sky-700 dark:text-sky-400 flex items-center justify-center text-xs font-bold">
                      {iniciais}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.email}</p>
                      {m.phone && <p className="text-xs text-gray-400 dark:text-gray-500">{m.phone}</p>}
                    </div>
                  </div>

                  {/* Setores */}
                  <div className="mt-2 lg:mt-0 flex flex-wrap gap-1">
                    {m.setores.map((s) => (
                      <span key={s} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SETOR_CORES[s] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s === 'TODOS' ? 'Todos' : s.charAt(0) + s.slice(1).toLowerCase()}
                      </span>
                    ))}
                  </div>

                  {/* Status */}
                  <div className="mt-2 lg:mt-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                      ${m.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {m.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="mt-3 lg:mt-0 flex items-center justify-center gap-1">
                    <button
                      onClick={() => abrirEditar(m)}
                      title="Editar"
                      className="p-2 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50
                        dark:hover:bg-sky-900/20 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleRemover(m.id)}
                      disabled={removendoId === m.id}
                      title="Remover"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50
                        dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    >
                      {removendoId === m.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />
                      }
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {membros.length} membro{membros.length !== 1 ? 's' : ''} na equipe
            </span>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Modal de criação / edição                                            */}
      {/* ================================================================== */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={fecharModal}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {editando ? 'Editar membro' : 'Adicionar membro'}
              </h2>
              <button
                onClick={fecharModal}
                disabled={salvando}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                />
              </div>

              {/* E-mail — só na criação */}
              {!editando && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com.br"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                  />
                </div>
              )}

              {/* Senha — só na criação */}
              {!editando && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Senha *
                  </label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                  />
                </div>
              )}

              {/* Telefone */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                />
              </div>

              {/* Status — só na edição */}
              {editando && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Status da conta</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {ativoModal ? 'Membro consegue fazer login' : 'Acesso bloqueado'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAtivoModal((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none
                      ${ativoModal ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform
                      ${ativoModal ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}

              {/* Setores */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Setores com acesso *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SETORES_OPCOES.map((s) => {
                    const ativo = setores.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleSetor(s.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium
                          transition-all focus-visible:outline-none
                          ${ativo
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-sky-300'
                          }`}
                      >
                        <span className={ativo ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400'}>{s.icon}</span>
                        {s.label}
                        {ativo && <CheckCircle2 size={13} className="ml-auto text-sky-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Erro do formulário */}
              {erroForm && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20
                  border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                  <AlertCircle size={14} className="shrink-0" />
                  {erroForm}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <button
                onClick={fecharModal}
                disabled={salvando}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300
                  bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700
                  disabled:opacity-40 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl
                  hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {salvando
                  ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
                  : editando ? 'Salvar alterações' : 'Cadastrar membro'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
