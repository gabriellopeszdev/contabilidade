'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserCog,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Pencil,
  ShieldCheck,
  FileText,
  Users as UsersIcon,
  Globe,
  UserX,
  UserCheck,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { validarEmail, validarTelefone, mascararTelefone } from '../../../src/utils/validators';

// =============================================================================
// Tipos
// =============================================================================

interface Funcionario {
  id:        string;
  name:      string;
  email:     string;
  phone:     string | null;
  setores:   string[];
  vinculo:   string;
  isActive:  boolean;
  createdAt: string;
  deletedAt: string | null;
}

const SETORES_OPCOES = [
  { value: 'TODOS',    label: 'Todos',    icon: <Globe size={14} />       },
  { value: 'FISCAL',   label: 'Fiscal',   icon: <FileText size={14} />   },
  { value: 'PESSOAL',  label: 'Pessoal',  icon: <UsersIcon size={14} />  },
  { value: 'CONTABIL', label: 'Contábil', icon: <ShieldCheck size={14} /> },
];

const SETOR_CORES: Record<string, string> = {
  TODOS:    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  FISCAL:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  PESSOAL:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  CONTABIL: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};

// =============================================================================
// Componente
// =============================================================================

export default function EquipePage() {
  const { token } = useAuth();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [modalAberto, setModalAberto]   = useState(false);
  const [editando, setEditando]         = useState<Funcionario | null>(null);

  // Form
  const [nome, setNome]       = useState('');
  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [phone, setPhone]     = useState('');
  const [setores, setSetores] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [mostrarDesligados, setMostrarDesligados] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------------------------------------------------------------
  // Carregar funcionários
  // -------------------------------------------------------------------------
  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const url = mostrarDesligados
        ? '/api/v1/equipe?incluirDesligados=true'
        : '/api/v1/equipe';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setFuncionarios(data.funcionarios ?? []);
    } catch { /* silêncio */ }
    setCarregando(false);
  }, [token, mostrarDesligados]);

  useEffect(() => { carregar(); }, [carregar]);

  // -------------------------------------------------------------------------
  // Toggle setor
  // -------------------------------------------------------------------------
  const toggleSetor = (s: string) => {
    setSetores((prev) => {
      // Se clicou em TODOS: seleciona só TODOS (ou desmarca se já estava)
      if (s === 'TODOS') {
        return prev.includes('TODOS') ? [] : ['TODOS'];
      }
      // Se clicou em setor individual: remove TODOS (se existia) e faz toggle
      const semTodos = prev.filter((x) => x !== 'TODOS');
      const novo = semTodos.includes(s)
        ? semTodos.filter((x) => x !== s)
        : [...semTodos, s];
      return novo;
    });
  };

  // -------------------------------------------------------------------------
  // Abrir modal para novo
  // -------------------------------------------------------------------------
  const abrirNovo = () => {
    setEditando(null);
    setNome('');
    setEmail('');
    setSenha('');
    setPhone('');
    setSetores([]);
    setModalAberto(true);
  };

  // Abrir modal para editar
  const abrirEdicao = (f: Funcionario) => {
    setEditando(f);
    setNome(f.name);
    setEmail(f.email);
    setSenha('');
    setPhone(f.phone ?? '');
    setSetores(f.setores);
    setModalAberto(true);
  };

  // -------------------------------------------------------------------------
  // Salvar (criar ou editar)
  // -------------------------------------------------------------------------
  const handleSalvar = async () => {
    if (!token) return;
    if (!nome.trim()) { setToast({ tipo: 'erro', msg: 'Nome é obrigatório.' }); return; }
    if (!editando && !email.trim()) { setToast({ tipo: 'erro', msg: 'E-mail é obrigatório.' }); return; }
    if (!editando && email.trim() && !validarEmail(email)) { setToast({ tipo: 'erro', msg: 'E-mail inválido.' }); return; }
    if (!editando && !senha) { setToast({ tipo: 'erro', msg: 'Senha é obrigatória.' }); return; }
    if (!editando && senha && senha.length < 8) { setToast({ tipo: 'erro', msg: 'A senha deve ter pelo menos 8 caracteres.' }); return; }
    if (phone.trim() && !validarTelefone(phone)) { setToast({ tipo: 'erro', msg: 'Telefone inválido. Ex: (11) 91234-5678' }); return; }
    if (setores.length === 0) { setToast({ tipo: 'erro', msg: 'Selecione pelo menos um setor.' }); return; }

    setSalvando(true);
    try {
      const url  = editando ? `/api/v1/equipe/${editando.id}` : '/api/v1/equipe';
      const method = editando ? 'PUT' : 'POST';
      const body: Record<string, unknown> = { name: nome.trim(), phone: phone.trim() || null, setores };
      if (!editando) {
        body.email = email.trim();
        body.senha = senha;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: data.message ?? 'Erro ao salvar.' });
        return;
      }

      setToast({ tipo: 'sucesso', msg: editando ? 'Funcionário atualizado!' : 'Funcionário cadastrado!' });
      setModalAberto(false);
      carregar();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro de conexão.' });
    } finally {
      setSalvando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Excluir
  // -------------------------------------------------------------------------
  const handleExcluir = async (id: string) => {
    if (!token) return;
    if (!confirm('Tem certeza que deseja remover este funcionário?')) return;

    try {
      const res = await fetch(`/api/v1/equipe/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setToast({ tipo: 'sucesso', msg: 'Funcionário removido.' });
        carregar();
      } else {
        const data = await res.json();
        setToast({ tipo: 'erro', msg: data.message ?? 'Erro ao excluir.' });
      }
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro de conexão.' });
    }
  };

  // -------------------------------------------------------------------------
  // Toggle ativo/inativo
  // -------------------------------------------------------------------------
  const toggleAtivo = async (f: Funcionario) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/equipe/${f.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !f.isActive }),
      });
      carregar();
    } catch { /* silêncio */ }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right ${
          toast.tipo === 'sucesso'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {toast.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2"><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCog size={22} className="shrink-0" />
            Gestão de Equipe
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cadastre funcionários e defina seus setores de acesso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setMostrarDesligados((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mostrarDesligados
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {mostrarDesligados ? <UserX size={16} /> : <UserCheck size={16} />}
            <span className="hidden sm:inline">{mostrarDesligados ? 'Ocultar Desligados' : 'Mostrar Desligados'}</span>
            <span className="sm:hidden">{mostrarDesligados ? 'Ocultar' : 'Desligados'}</span>
          </button>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Novo Funcionário
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : funcionarios.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
            Nenhum funcionário cadastrado. Clique em &quot;Novo Funcionário&quot; para começar.
          </div>
        ) : (
          <>
          <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {funcionarios.map((f) => {
              const desligado = f.deletedAt !== null;
              return (
                <li key={f.id} className={`p-4 space-y-3 ${!f.isActive && !desligado ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <p className={`font-medium text-gray-900 dark:text-gray-100 truncate ${desligado ? 'opacity-40 line-through' : ''}`}>{f.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{f.email}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {f.setores.map((s) => (
                      <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${SETOR_CORES[s] ?? 'bg-gray-100 text-gray-600'}`}>
                        {SETORES_OPCOES.find((o) => o.value === s)?.icon}
                        {SETORES_OPCOES.find((o) => o.value === s)?.label ?? s}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {desligado ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        Desligado
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleAtivo(f)}
                        className={`inline-flex items-center min-h-[44px] rounded-full px-3 text-xs font-medium transition-colors ${
                          f.isActive
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {f.isActive ? 'Ativo' : 'Inativo'}
                      </button>
                    )}
                    {!desligado && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEdicao(f)}
                          aria-label="Editar"
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleExcluir(f.id)}
                          aria-label="Excluir"
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Setores</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {funcionarios.map((f) => {
                const desligado = f.deletedAt !== null;
                return (
                  <tr key={f.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!f.isActive && !desligado ? 'opacity-50' : ''}`}>
                    <td className={`px-4 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate ${desligado ? 'opacity-40 line-through' : ''}`}>{f.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{f.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {f.setores.map((s) => (
                          <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${SETOR_CORES[s] ?? 'bg-gray-100 text-gray-600'}`}>
                            {SETORES_OPCOES.find((o) => o.value === s)?.icon}
                            {SETORES_OPCOES.find((o) => o.value === s)?.label ?? s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {desligado ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          Desligado
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleAtivo(f)}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            f.isActive
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/40'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {f.isActive ? 'Ativo' : 'Inativo'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!desligado && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => abrirEdicao(f)}
                            className="rounded-lg min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleExcluir(f.id)}
                            className="rounded-lg min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalAberto(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-4 sm:p-6 space-y-5 max-h-[100dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {editando ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <button onClick={() => setModalAberto(false)} aria-label="Fechar" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Nome completo"
                />
              </div>

              {/* E-mail (só na criação) */}
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="colaborador@escritorio.com"
                  />
                </div>
              )}

              {/* Senha (só na criação) */}
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha *</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
              )}

              {/* Telefone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(mascararTelefone(e.target.value))}
                  maxLength={15}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="(11) 99999-0000"
                />
              </div>

              {/* Setores */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Setores de Acesso *</label>
                <div className="flex gap-2 flex-wrap">
                  {SETORES_OPCOES.map((op) => {
                    const selecionado = setores.includes(op.value);
                    return (
                      <button
                        key={op.value}
                        type="button"
                        onClick={() => toggleSetor(op.value)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                          selecionado
                            ? `${SETOR_CORES[op.value]} border-transparent`
                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {op.icon}
                        {op.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
                {editando ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
