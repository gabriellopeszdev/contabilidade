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
      const res = await fetch('/api/v1/equipe', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setFuncionarios(data.funcionarios ?? []);
    } catch { /* silêncio */ }
    setCarregando(false);
  }, [token]);

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
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right ${
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCog size={22} />
            Gestão de Equipe
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cadastre funcionários e defina seus setores de acesso.
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Funcionário
        </button>
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
          <table className="w-full text-sm">
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
              {funcionarios.map((f) => (
                <tr key={f.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!f.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{f.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{f.email}</td>
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
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => abrirEdicao(f)}
                        className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleExcluir(f.id)}
                        className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalAberto(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editando ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
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
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
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
