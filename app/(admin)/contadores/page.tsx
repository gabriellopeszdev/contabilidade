'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Building2,
  Users,
  ShieldOff,
  ShieldCheck,
  Loader2,
  X,
  Search,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Pencil,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface ContadorDTO {
  id:               string;
  name:             string;
  email:            string;
  crc:              string;
  isActive:         boolean;
  totalClientes:    number;
  nomeEscritorio:   string | null;
  cnpjEscritorio:   string | null;
  asaasConfigurado: boolean;
  createdAt:        string;
}

interface NovoContadorForm {
  name:            string;
  email:           string;
  crc:             string;
  senhaProvisoria: string;
  nomeEscritorio:  string;
  cnpjEscritorio:  string;
}

const FORM_INICIAL: NovoContadorForm = {
  name:            '',
  email:           '',
  crc:             '',
  senhaProvisoria: '',
  nomeEscritorio:  '',
  cnpjEscritorio:  '',
};

// =============================================================================
// Componentes auxiliares
// =============================================================================

function BadgeStatus({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Bloqueado
    </span>
  );
}

// =============================================================================
// Modal de criação
// =============================================================================

interface ModalCriarContadorProps {
  onClose:  () => void;
  onCriado: (contador: ContadorDTO) => void;
  token:    string;
}

function ModalCriarContador({ onClose, onCriado, token }: ModalCriarContadorProps) {
  const [form,     setForm]     = useState<NovoContadorForm>(FORM_INICIAL);
  const [erros,    setErros]    = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErros([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const novosErros: string[] = [];
    if (!form.name.trim())            novosErros.push('Nome é obrigatório.');
    if (!form.email.trim())           novosErros.push('E-mail é obrigatório.');
    if (!form.crc.trim())             novosErros.push('CRC é obrigatório.');
    if (form.senhaProvisoria.length < 8) novosErros.push('Senha deve ter ao menos 8 caracteres.');
    if (!form.nomeEscritorio.trim())  novosErros.push('Nome do escritório é obrigatório.');
    if (novosErros.length > 0) { setErros(novosErros); return; }

    setEnviando(true);
    try {
      const res = await fetch('/api/v1/admin/contadores', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:            form.name.trim(),
          email:           form.email.trim().toLowerCase(),
          crc:             form.crc.trim().toUpperCase(),
          senhaProvisoria: form.senhaProvisoria,
          nomeEscritorio:  form.nomeEscritorio.trim(),
          cnpjEscritorio:  form.cnpjEscritorio.trim() || undefined,
        }),
      });

      const data = await res.json() as { message?: string; erros?: string[]; id?: string; name?: string; email?: string; crc?: string };

      if (!res.ok) {
        setErros(data.erros ?? [data.message ?? `Erro HTTP ${res.status}`]);
        return;
      }

      // Constructs a minimal DTO to insert into the table immediately
      onCriado({
        id:               data.id!,
        name:             data.name!,
        email:            data.email!,
        crc:              data.crc!,
        isActive:         true,
        totalClientes:    0,
        nomeEscritorio:   form.nomeEscritorio.trim(),
        cnpjEscritorio:   form.cnpjEscritorio.trim() || null,
        asaasConfigurado: false,
        createdAt:        new Date().toISOString(),
      });
    } catch {
      setErros(['Erro de rede. Verifique sua conexão e tente novamente.']);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">Novo Contador / Escritório</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {erros.length > 0 && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5 space-y-0.5">
              {erros.map((e, i) => (
                <p key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  {e}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome completo *
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="João Silva"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">E-mail *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="joao@escritorio.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">CRC *</label>
              <input
                name="crc"
                value={form.crc}
                onChange={handleChange}
                placeholder="CRC-SP/123456"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Senha provisória *
              </label>
              <input
                name="senhaProvisoria"
                type="password"
                value={form.senhaProvisoria}
                onChange={handleChange}
                placeholder="mín. 8 caracteres"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome do escritório *
              </label>
              <input
                name="nomeEscritorio"
                value={form.nomeEscritorio}
                onChange={handleChange}
                placeholder="Silva & Associados Contabilidade"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                CNPJ do escritório
                <span className="text-slate-600 ml-1">(opcional)</span>
              </label>
              <input
                name="cnpjEscritorio"
                value={form.cnpjEscritorio}
                onChange={handleChange}
                placeholder="14 dígitos sem pontuação"
                maxLength={14}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {enviando ? 'Criando…' : 'Criar Contador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Modal Editar Contador
// =============================================================================

interface ModalEditarContadorProps {
  contador: ContadorDTO;
  onClose:  () => void;
  onSalvo:  (atualizado: Partial<ContadorDTO>) => void;
  token:    string;
}

function ModalEditarContador({ contador, onClose, onSalvo, token }: ModalEditarContadorProps) {
  const [form, setForm] = useState({
    name:           contador.name,
    email:          contador.email,
    crc:            contador.crc,
    nomeEscritorio: contador.nomeEscritorio ?? '',
    cnpjEscritorio: contador.cnpjEscritorio ?? '',
  });
  const [erros,    setErros]    = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro,     setErro]     = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErros((prev) => { const n = { ...prev }; delete n[e.target.name]; return n; });
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(form),
      });
      const data = await res.json() as { ok?: boolean; message?: string; fields?: Record<string, string> };
      if (!res.ok) {
        if (data.fields) setErros(data.fields);
        setErro(data.message ?? `Erro HTTP ${res.status}`);
        return;
      }
      onSalvo({
        name:           form.name,
        email:          form.email,
        crc:            form.crc.toUpperCase(),
        nomeEscritorio: form.nomeEscritorio,
        cnpjEscritorio: form.cnpjEscritorio || null,
      });
      onClose();
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const field = (name: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[11px] font-medium text-slate-400 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 ${erros[name] ? 'border-red-500' : 'border-slate-700'}`}
      />
      {erros[name] && <p className="text-xs text-red-400 mt-1">{erros[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white">Editar Escritório</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {erro && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{erro}</p>
            </div>
          )}

          {field('name',           'Nome completo *',       'text',  'João Silva')}
          {field('email',          'E-mail *',              'email', 'joao@escritorio.com')}

          <div className="grid grid-cols-2 gap-3">
            {field('crc',            'CRC *',               'text',  'CRC-SP/123456')}
            {field('cnpjEscritorio', 'CNPJ do escritório',  'text',  '14 dígitos (opcional)')}
          </div>

          {field('nomeEscritorio', 'Nome do escritório *',  'text',  'Silva & Associados')}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={enviando}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg transition-colors">
              {enviando && <Loader2 size={13} className="animate-spin" />}
              {enviando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Modal Asaas — configura chave de API por contador
// =============================================================================

interface ModalAsaasProps {
  contador: ContadorDTO;
  onClose:  () => void;
  onSalvo:  (configurado: boolean) => void;
  token:    string;
}

function ModalAsaas({ contador, onClose, onSalvo, token }: ModalAsaasProps) {
  const [apiKey,   setApiKey]   = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro,     setErro]     = useState('');
  const [sucesso,  setSucesso]  = useState('');

  const handleSalvar = async () => {
    setErro('');
    setSucesso('');
    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/asaas`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json() as { ok?: boolean; message?: string; configurado?: boolean; nomeEmpresaAsaas?: string };
      if (!res.ok) { setErro(data.message ?? `Erro HTTP ${res.status}`); return; }
      const msg = apiKey.trim()
        ? `Chave salva!${data.nomeEmpresaAsaas ? ` Conta: ${data.nomeEmpresaAsaas}` : ''}`
        : 'Chave removida com sucesso.';
      setSucesso(msg);
      onSalvo(data.configurado ?? Boolean(apiKey.trim()));
      setTimeout(onClose, 1200);
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async () => {
    setApiKey('');
    setErro('');
    setSucesso('');
    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/asaas`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ apiKey: '' }),
      });
      if (!res.ok) { const d = await res.json(); setErro(d.message ?? 'Erro.'); return; }
      setSucesso('Chave removida.');
      onSalvo(false);
      setTimeout(onClose, 1200);
    } catch {
      setErro('Erro de rede.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white">Integração Asaas</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status atual */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${contador.asaasConfigurado ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            <span className={`w-2 h-2 rounded-full ${contador.asaasConfigurado ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {contador.asaasConfigurado ? 'Asaas configurado — boletos reais ativos' : 'Sem chave — usando PDF local (fallback)'}
          </div>

          {erro && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="flex items-start gap-2 bg-emerald-900/30 border border-emerald-700/50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300">{sucesso}</p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              API Key do Asaas
              <span className="text-slate-600 ml-1">(deixe vazio para remover)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setErro(''); setSucesso(''); }}
              placeholder="$aact_…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Encontre em: Minha Conta → Integrações → Gerar chave de API no painel Asaas do contador.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          {contador.asaasConfigurado && !apiKey && (
            <button
              type="button"
              onClick={handleRemover}
              disabled={salvando}
              className="px-4 py-2 text-xs font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 rounded-lg transition-colors disabled:opacity-50"
            >
              Remover chave
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !apiKey.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {salvando ? 'Validando…' : 'Salvar chave'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página principal
// =============================================================================

export default function ContadoresPage() {
  const { getToken, token } = useAuth();

  const [contadores,    setContadores]    = useState<ContadorDTO[]>([]);
  const [carregando,    setCarregando]    = useState(true);
  const [erro,          setErro]          = useState<string | null>(null);
  const [modalAberto,   setModalAberto]   = useState(false);
  const [busca,         setBusca]         = useState('');
  const [toggling,      setToggling]      = useState<string | null>(null); // id do row em transição
  const [modalAsaas,    setModalAsaas]    = useState<ContadorDTO | null>(null);
  const [modalEditar,   setModalEditar]   = useState<ContadorDTO | null>(null);

  // Carrega lista
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const token = await getToken();
      const res   = await fetch('/api/v1/admin/contadores', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const data = (await res.json()) as { items: ContadorDTO[] };
      setContadores(data.items);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar contadores.');
    } finally {
      setCarregando(false);
    }
  }, [getToken]);

  useEffect(() => { carregar(); }, [carregar]);

  // Toggle de status
  const toggleStatus = useCallback(async (id: string, isActiveAtual: boolean) => {
    setToggling(id);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/v1/admin/contadores/${id}/status`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActiveAtual }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? `Erro HTTP ${res.status}`);
      }

      // Atualização otimista
      setContadores((prev) =>
        prev.map((c) => c.id === id ? { ...c, isActive: !isActiveAtual } : c),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar status.');
    } finally {
      setToggling(null);
    }
  }, [getToken]);

  // Filtragem por busca
  const contadoresFiltrados = contadores.filter((c) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      c.name.toLowerCase().includes(q)          ||
      c.email.toLowerCase().includes(q)         ||
      c.crc.toLowerCase().includes(q)           ||
      (c.nomeEscritorio ?? '').toLowerCase().includes(q)
    );
  });

  const formatarData = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Modal: criar contador */}
      {modalAberto && (
        <ModalCriarContador
          token={token ?? ''}
          onClose={() => setModalAberto(false)}
          onCriado={(novo) => {
            setContadores((prev) => [novo, ...prev]);
            setModalAberto(false);
          }}
        />
      )}

      {/* Modal: Editar */}
      {modalEditar && (
        <ModalEditarContador
          contador={modalEditar}
          token={token ?? ''}
          onClose={() => setModalEditar(null)}
          onSalvo={(atualizado) => {
            setContadores((prev) =>
              prev.map((c) => c.id === modalEditar.id ? { ...c, ...atualizado } : c),
            );
          }}
        />
      )}

      {/* Modal: Asaas */}
      {modalAsaas && (
        <ModalAsaas
          contador={modalAsaas}
          token={token ?? ''}
          onClose={() => setModalAsaas(null)}
          onSalvo={(configurado) => {
            setContadores((prev) =>
              prev.map((c) => c.id === modalAsaas.id ? { ...c, asaasConfigurado: configurado } : c),
            );
          }}
        />
      )}

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Escritórios Cadastrados</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {carregando ? 'Carregando…' : `${contadores.length} escritório${contadores.length !== 1 ? 's' : ''} na plataforma`}
            </p>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors shrink-0"
          >
            <Plus size={16} />
            Novo Contador
          </button>
        </div>

        {/* Barra de busca */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, CRC ou escritório…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Estados: loading / erro / vazio */}
        {carregando && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-violet-400" />
          </div>
        )}

        {!carregando && erro && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-6 text-center">
            <p className="text-sm text-red-300">{erro}</p>
            <button
              onClick={carregar}
              className="mt-3 text-xs text-violet-400 hover:text-violet-300 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !erro && contadoresFiltrados.length === 0 && (
          <div className="text-center py-24">
            <Building2 size={36} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">
              {busca ? 'Nenhum resultado para a busca.' : 'Nenhum escritório cadastrado ainda.'}
            </p>
          </div>
        )}

        {/* Tabela */}
        {!carregando && !erro && contadoresFiltrados.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">
                      Contador / Escritório
                    </th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">
                      CRC
                    </th>
                    <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">
                      <Users size={12} className="inline mr-1" />
                      Clientes
                    </th>
                    <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">
                      Criado em
                    </th>
                    <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">
                      Asaas
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {contadoresFiltrados.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors group">

                      {/* Nome + escritório + e-mail */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-700/40 text-violet-300 flex items-center justify-center text-xs font-bold shrink-0">
                            {c.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-100 truncate">{c.name}</p>
                            <p className="text-xs text-slate-500 truncate">{c.email}</p>
                            {c.nomeEscritorio && (
                              <p className="text-[11px] text-violet-400/80 truncate">{c.nomeEscritorio}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CRC */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                          {c.crc}
                        </span>
                      </td>

                      {/* Clientes */}
                      <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                        <span className="text-sm font-semibold text-slate-200">
                          {c.totalClientes}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <BadgeStatus isActive={c.isActive} />
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        <span className="text-xs text-slate-500">{formatarData(c.createdAt)}</span>
                      </td>

                      {/* Asaas */}
                      <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          c.asaasConfigurado
                            ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40'
                            : 'text-slate-500 bg-slate-800 border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.asaasConfigurado ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          {c.asaasConfigurado ? 'Ativo' : 'Sem chave'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Editar */}
                          <button
                            onClick={() => setModalEditar(c)}
                            title="Editar dados"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                          >
                            <Pencil size={12} />
                            Editar
                          </button>

                          {/* Asaas */}
                          <button
                            onClick={() => setModalAsaas(c)}
                            title="Configurar integração Asaas"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              c.asaasConfigurado
                                ? 'text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40 border-emerald-800/40'
                                : 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700'
                            }`}
                          >
                            <KeyRound size={12} />
                            Asaas
                          </button>

                          {/* Bloquear/Desbloquear */}
                          <button
                            onClick={() => toggleStatus(c.id, c.isActive)}
                            disabled={toggling === c.id}
                            title={c.isActive ? 'Bloquear acesso' : 'Desbloquear acesso'}
                            className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                              transition-colors disabled:opacity-50
                              ${c.isActive
                                ? 'text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40'
                                : 'text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/40'
                              }
                            `}
                          >
                            {toggling === c.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : c.isActive ? (
                              <ShieldOff size={12} />
                            ) : (
                              <ShieldCheck size={12} />
                            )}
                            {c.isActive ? 'Bloquear' : 'Desbloquear'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé da tabela */}
            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {contadoresFiltrados.length} de {contadores.length} escritório{contadores.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={carregar}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Atualizar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
