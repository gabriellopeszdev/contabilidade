'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface PlanoDTO {
  id:               string;
  nome:             string;
  descricao:        string | null;
  preco:            number;
  limiteClientes:   number;
  limiteDocumentos: number;
  features:         string[];
  isActive:         boolean;
  assinantes:       number;
  createdAt:        string;
}

interface PlanoForm {
  nome:             string;
  descricao:        string;
  preco:            string;
  limiteClientes:   string;
  limiteDocumentos: string;
  features:         string[];
  isActive:         boolean;
}

const FORM_VAZIO: PlanoForm = {
  nome:             '',
  descricao:        '',
  preco:            '',
  limiteClientes:   '',
  limiteDocumentos: '',
  features:         [],
  isActive:         true,
};

// =============================================================================
// Componente: Modal de criação / edição de plano
// =============================================================================

function ModalPlano({
  modo,
  plano,
  onFechar,
  onSalvar,
  salvando,
  erro,
}: {
  modo:      'criar' | 'editar';
  plano:     PlanoForm;
  onFechar:  () => void;
  onSalvar:  (form: PlanoForm) => void;
  salvando:  boolean;
  erro:      string | null;
}) {
  const [form, setForm]           = useState<PlanoForm>(plano);
  const [tagInput, setTagInput]   = useState('');

  function setField<K extends keyof PlanoForm>(key: K, value: PlanoForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function adicionarFeature(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !form.features.includes(val)) {
        setField('features', [...form.features, val]);
      }
      setTagInput('');
    }
  }

  function removerFeature(f: string) {
    setField('features', form.features.filter((x) => x !== f));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onFechar} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">
            {modo === 'criar' ? 'Novo Plano' : 'Editar Plano'}
          </h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 text-red-400 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={15} />
              {erro}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do Plano *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setField('nome', e.target.value)}
              placeholder="Ex: Pro"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição</label>
            <input
              type="text"
              value={form.descricao}
              onChange={(e) => setField('descricao', e.target.value)}
              placeholder="Breve descrição do plano"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          {/* Preço */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Preço / mês (R$) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.preco}
              onChange={(e) => setField('preco', e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Limite de Clientes *</label>
              <input
                type="number"
                min="0"
                value={form.limiteClientes}
                onChange={(e) => setField('limiteClientes', e.target.value)}
                placeholder="50"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Limite de Documentos *</label>
              <input
                type="number"
                min="0"
                value={form.limiteDocumentos}
                onChange={(e) => setField('limiteDocumentos', e.target.value)}
                placeholder="500"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Funcionalidades <span className="text-slate-600">(Enter para adicionar)</span>
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 min-h-[60px]">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.features.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 bg-violet-600/20 border border-violet-600/40 text-violet-300 text-xs px-2 py-0.5 rounded-full"
                  >
                    {f}
                    <button
                      type="button"
                      onClick={() => removerFeature(f)}
                      className="hover:text-white transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={adicionarFeature}
                placeholder="Digite e pressione Enter..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* isActive (somente edição) */}
          {modo === 'editar' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setField('isActive', !form.isActive)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-violet-600' : 'bg-slate-700'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
              <span className="text-sm text-slate-300">
                {form.isActive ? 'Plano ativo' : 'Plano inativo'}
              </span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 justify-end">
          <button
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(form)}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {modo === 'criar' ? 'Criar Plano' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Card de Plano
// =============================================================================

function CardPlano({
  plano,
  onEditar,
  onExcluir,
}: {
  plano:     PlanoDTO;
  onEditar:  (p: PlanoDTO) => void;
  onExcluir: (p: PlanoDTO) => void;
}) {
  return (
    <div className={`bg-slate-900 border rounded-xl p-5 flex flex-col gap-4 ${plano.isActive ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}>
      {/* Topo */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white truncate">{plano.nome}</h3>
            {plano.isActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-1.5 py-0.5 rounded-full shrink-0">
                <CheckCircle2 size={9} />
                Ativo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full shrink-0">
                <XCircle size={9} />
                Inativo
              </span>
            )}
          </div>
          {plano.descricao && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{plano.descricao}</p>
          )}
        </div>
        <p className="text-xl font-bold text-violet-400 shrink-0">
          {plano.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          <span className="text-xs text-slate-500 font-normal">/mês</span>
        </p>
      </div>

      {/* Limites */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 rounded-lg px-3 py-2 flex items-center gap-2">
          <Users size={13} className="text-slate-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500">Clientes</p>
            <p className="text-sm font-semibold text-slate-200">{plano.limiteClientes}</p>
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg px-3 py-2 flex items-center gap-2">
          <FileText size={13} className="text-slate-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500">Documentos</p>
            <p className="text-sm font-semibold text-slate-200">{plano.limiteDocumentos}</p>
          </div>
        </div>
      </div>

      {/* Features */}
      {plano.features.length > 0 && (
        <ul className="space-y-1">
          {plano.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1 h-1 rounded-full bg-violet-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-300">{plano.assinantes}</span> assinante(s) ativo(s)
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEditar(plano)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Pencil size={12} />
            Editar
          </button>
          <button
            onClick={() => onExcluir(plano)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={12} />
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página principal
// =============================================================================

export default function PlanosPage() {
  const { token } = useAuth();

  const [planos,    setPlanos]    = useState<PlanoDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  // Modal criar
  const [modalCriar, setModalCriar] = useState(false);
  const [salvandoCriar, setSalvandoCriar] = useState<boolean>(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);

  // Modal editar
  const [planoEditando, setPlanoEditando] = useState<PlanoDTO | null>(null);
  const [salvandoEditar, setSalvandoEditar] = useState(false);
  const [erroEditar, setErroEditar] = useState<string | null>(null);

  // Confirmação de exclusão
  const [planoExcluindo, setPlanoExcluindo] = useState<PlanoDTO | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarPlanos = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const res = await fetch('/api/v1/admin/planos', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as PlanoDTO[];
      setPlanos(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar planos.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => { carregarPlanos(); }, [carregarPlanos]);

  // Criar plano
  async function criarPlano(form: PlanoForm) {
    if (!token) return;
    setSalvandoCriar(true);
    setErroCriar(null);
    try {
      const res = await fetch('/api/v1/admin/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome:             form.nome,
          descricao:        form.descricao || undefined,
          preco:            parseFloat(form.preco),
          limiteClientes:   parseInt(form.limiteClientes, 10),
          limiteDocumentos: parseInt(form.limiteDocumentos, 10),
          features:         form.features,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setModalCriar(false);
      await carregarPlanos();
    } catch (e) {
      setErroCriar(e instanceof Error ? e.message : 'Erro ao criar plano.');
    } finally {
      setSalvandoCriar(false);
    }
  }

  // Editar plano
  async function editarPlano(form: PlanoForm) {
    if (!token || !planoEditando) return;
    setSalvandoEditar(true);
    setErroEditar(null);
    try {
      const res = await fetch(`/api/v1/admin/planos/${planoEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome:             form.nome,
          descricao:        form.descricao || null,
          preco:            parseFloat(form.preco),
          limiteClientes:   parseInt(form.limiteClientes, 10),
          limiteDocumentos: parseInt(form.limiteDocumentos, 10),
          features:         form.features,
          isActive:         form.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setPlanoEditando(null);
      await carregarPlanos();
    } catch (e) {
      setErroEditar(e instanceof Error ? e.message : 'Erro ao editar plano.');
    } finally {
      setSalvandoEditar(false);
    }
  }

  // Excluir plano
  async function excluirPlano() {
    if (!token || !planoExcluindo) return;
    setExcluindo(true);
    try {
      const res = await fetch(`/api/v1/admin/planos/${planoExcluindo.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setPlanoExcluindo(null);
      await carregarPlanos();
    } catch (e) {
      // Reaproveitamos o erro no modal de confirmação
      alert(e instanceof Error ? e.message : 'Erro ao excluir plano.');
    } finally {
      setExcluindo(false);
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package size={20} className="text-violet-400" />
            <h1 className="text-xl font-bold text-white">Planos SaaS</h1>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Gerencie os planos de assinatura disponíveis para os escritórios.
          </p>
        </div>
        <button
          onClick={() => { setModalCriar(true); setErroCriar(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Novo Plano
        </button>
      </div>

      {/* Estados de carregamento / erro */}
      {carregando && (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      )}

      {!carregando && erro && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
          <AlertCircle size={18} />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {/* Grid de planos */}
      {!carregando && !erro && (
        <>
          {planos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-900 border border-slate-800 rounded-xl">
              <Package size={36} className="text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">Nenhum plano cadastrado ainda.</p>
              <button
                onClick={() => setModalCriar(true)}
                className="mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Criar o primeiro plano
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {planos.map((p) => (
                <CardPlano
                  key={p.id}
                  plano={p}
                  onEditar={(pl) => {
                    setErroEditar(null);
                    setPlanoEditando(pl);
                  }}
                  onExcluir={(pl) => setPlanoExcluindo(pl)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Criar */}
      {modalCriar && (
        <ModalPlano
          modo="criar"
          plano={FORM_VAZIO}
          onFechar={() => setModalCriar(false)}
          onSalvar={criarPlano}
          salvando={salvandoCriar}
          erro={erroCriar}
        />
      )}

      {/* Modal: Editar */}
      {planoEditando && (
        <ModalPlano
          modo="editar"
          plano={{
            nome:             planoEditando.nome,
            descricao:        planoEditando.descricao ?? '',
            preco:            String(planoEditando.preco),
            limiteClientes:   String(planoEditando.limiteClientes),
            limiteDocumentos: String(planoEditando.limiteDocumentos),
            features:         planoEditando.features,
            isActive:         planoEditando.isActive,
          }}
          onFechar={() => setPlanoEditando(null)}
          onSalvar={editarPlano}
          salvando={salvandoEditar}
          erro={erroEditar}
        />
      )}

      {/* Modal: Confirmação de exclusão */}
      {planoExcluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setPlanoExcluindo(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-red-900/30">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Excluir plano</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              Tem certeza que deseja excluir o plano{' '}
              <span className="font-semibold text-white">{planoExcluindo.nome}</span>?
            </p>
            {planoExcluindo.assinantes > 0 && (
              <div className="bg-amber-900/20 border border-amber-700/40 text-amber-400 rounded-lg px-4 py-3 text-xs mb-4">
                <strong>Atenção:</strong> Este plano possui{' '}
                <strong>{planoExcluindo.assinantes}</strong> assinante(s) ativo(s).
                Migre-os para outro plano antes de excluir.
              </div>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setPlanoExcluindo(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={excluirPlano}
                disabled={excluindo}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {excluindo && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
