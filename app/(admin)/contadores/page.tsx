'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  CreditCard,
  Bot,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
} from 'lucide-react';

import { IA_PROVIDERS, type IaProvider } from '../../../src/utils/aiProviders';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import type { ProviderAssinatura } from '@prisma/client';

// =============================================================================
// Tipos
// =============================================================================

interface ContadorDTO {
  id:               string;
  name:             string;
  email:            string;
  crc:              string | null;
  isActive:         boolean;
  totalClientes:    number;
  nomeEscritorio:   string | null;
  cnpjEscritorio:   string | null;
  asaasConfigurado: boolean;
  coraConfigurado:  boolean;
  iaPersonalizada:  boolean;
  iaProvider:       string | null;
  providerAssinatura: 'INTERNO' | 'ZAPSIGN';
  createdAt:        string;
  planoId:          string | null;
  planoNome:        string | null;
  statusAssinatura: string | null;
  dataRenovacao:    string | null;
}

interface PlanoDTO {
  id:    string;
  nome:  string;
  preco: number;
}

interface NovoContadorForm {
  tipo:            'AUTONOMO' | 'EMPRESA';
  name:            string;
  email:           string;
  crc:             string;
  senhaProvisoria: string;
  nomeEscritorio:  string;
  cnpjEscritorio:  string;
  planoId:         string;
  providerAssinatura: string;
}

const FORM_INICIAL: NovoContadorForm = {
  tipo:            'AUTONOMO',
  name:            '',
  email:           '',
  crc:             '',
  senhaProvisoria: '',
  nomeEscritorio:  '',
  cnpjEscritorio:  '',
  planoId:         '',
  providerAssinatura: 'INTERNO',
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
  const [planos,   setPlanos]   = useState<PlanoDTO[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalRef.current) modalRef.current.focus(); }, []);

  useEffect(() => {
    fetch('/api/v1/planos')
      .then((r) => r.json())
      .then((d) => {
        const lista: PlanoDTO[] = d.planos ?? [];
        setPlanos(lista);
        if (lista.length > 0) setForm((f) => ({ ...f, planoId: lista[0].id }));
      })
      .catch(() => toast.error('Não foi possível carregar os planos disponíveis.'));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErros([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const novosErros: string[] = [];
    if (!form.name.trim())            novosErros.push('Nome é obrigatório.');
    if (!form.email.trim())           novosErros.push('E-mail é obrigatório.');
    
    if (form.tipo === 'AUTONOMO') {
      if (!form.crc.trim())           novosErros.push('CRC é obrigatório para Contador Autônomo.');
    } else {
      if (!form.cnpjEscritorio.trim()) novosErros.push('CNPJ do escritório é obrigatório para Empresa.');
    }
    
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
          tipo:            form.tipo,
          name:            form.name.trim(),
          email:           form.email.trim().toLowerCase(),
          crc:             form.tipo === 'AUTONOMO' ? form.crc.trim().toUpperCase() : (form.crc.trim().toUpperCase() || undefined),
          senhaProvisoria: form.senhaProvisoria,
          nomeEscritorio:  form.nomeEscritorio.trim(),
          cnpjEscritorio:  form.cnpjEscritorio.trim() || undefined,
          planoId:         form.planoId || undefined,
          providerAssinatura: form.providerAssinatura,
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
        crc:              data.crc ?? null,
        isActive:         true,
        totalClientes:    0,
        nomeEscritorio:   form.nomeEscritorio.trim(),
        cnpjEscritorio:   form.cnpjEscritorio.trim() || null,
        asaasConfigurado: false,
        coraConfigurado:  false,
        providerAssinatura: form.providerAssinatura as ProviderAssinatura,
        createdAt:        new Date().toISOString(),
        planoId:          form.planoId || null,
        planoNome:        null,
        statusAssinatura: 'TRIAL',
        dataRenovacao:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        iaPersonalizada:  false,
        iaProvider:       null,
      });
    } catch {
      setErros(['Erro de rede. Verifique sua conexão e tente novamente.']);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-criar-contador-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 id="modal-criar-contador-titulo" className="text-sm font-bold text-white">Novo Contador / Escritório</h2>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
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

          {/* Tipo de Perfil */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
              Tipo de Perfil *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="AUTONOMO"
                  checked={form.tipo === 'AUTONOMO'}
                  onChange={() => setForm((f) => ({ ...f, tipo: 'AUTONOMO' }))}
                  className="accent-violet-500"
                />
                Contador Autônomo
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="EMPRESA"
                  checked={form.tipo === 'EMPRESA'}
                  onChange={() => setForm((f) => ({ ...f, tipo: 'EMPRESA' }))}
                  className="accent-violet-500"
                />
                Empresa de Contabilidade
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor="criar-nome" className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome completo *
              </label>
              <input
                id="criar-nome"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="João Silva"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="criar-email" className="block text-[11px] font-medium text-slate-400 mb-1">E-mail *</label>
              <input
                id="criar-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="joao@escritorio.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label htmlFor="criar-crc" className="block text-[11px] font-medium text-slate-400 mb-1">
                {form.tipo === 'AUTONOMO' ? 'CRC *' : 'CRC (opcional)'}
              </label>
              <input
                id="criar-crc"
                name="crc"
                value={form.crc}
                onChange={handleChange}
                placeholder="CRC-SP/123456"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label htmlFor="criar-senha-provisoria" className="block text-[11px] font-medium text-slate-400 mb-1">
                Senha provisória *
              </label>
              <input
                id="criar-senha-provisoria"
                name="senhaProvisoria"
                type="password"
                value={form.senhaProvisoria}
                onChange={handleChange}
                placeholder="mín. 8 caracteres"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="criar-nome-escritorio" className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome do escritório *
              </label>
              <input
                id="criar-nome-escritorio"
                name="nomeEscritorio"
                value={form.nomeEscritorio}
                onChange={handleChange}
                placeholder="Silva & Associados Contabilidade"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="criar-cnpj" className="block text-[11px] font-medium text-slate-400 mb-1">
                {form.tipo === 'EMPRESA' ? 'CNPJ do escritório *' : 'CNPJ do escritório (opcional)'}
              </label>
              <input
                id="criar-cnpj"
                name="cnpjEscritorio"
                value={form.cnpjEscritorio}
                onChange={handleChange}
                placeholder="14 dígitos sem pontuação"
                maxLength={14}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {planos.length > 0 && (
              <div className="col-span-2">
                <label htmlFor="criar-plano" className="block text-[11px] font-medium text-slate-400 mb-1">
                  Plano de trial <span className="text-slate-500">(7 dias gratuitos)</span>
                </label>
                <select
                  id="criar-plano"
                  name="planoId"
                  value={form.planoId}
                  onChange={(e) => setForm((f) => ({ ...f, planoId: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label htmlFor="criar-provider-assinatura" className="block text-[11px] font-medium text-slate-400 mb-1">
                Provedor de Assinatura *
              </label>
              <select
                id="criar-provider-assinatura"
                name="providerAssinatura"
                value={form.providerAssinatura}
                onChange={(e) => setForm((f) => ({ ...f, providerAssinatura: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="INTERNO">Interno (FiscoHub)</option>
                <option value="ZAPSIGN">ZapSign</option>
              </select>
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
    name:           contador.name as string,
    email:          contador.email as string,
    crc:            (contador.crc ?? '') as string,
    nomeEscritorio: (contador.nomeEscritorio ?? '') as string,
    cnpjEscritorio: (contador.cnpjEscritorio ?? '') as string,
    providerAssinatura: (contador.providerAssinatura ?? 'INTERNO') as string,
  });
  const [erros,    setErros]    = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro,     setErro]     = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalRef.current) modalRef.current.focus(); }, []);

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
        crc:            form.crc.trim() ? form.crc.trim().toUpperCase() : null,
        nomeEscritorio: form.nomeEscritorio,
        cnpjEscritorio: form.cnpjEscritorio || null,
        providerAssinatura: form.providerAssinatura as ProviderAssinatura,
      });
      onClose();
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const field = (name: keyof typeof form, label: string, type = 'text', placeholder = '') => {
    const fieldId = `editar-${name.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)}`;
    return (
      <div>
        <label htmlFor={fieldId} className="block text-[11px] font-medium text-slate-400 mb-1">{label}</label>
        <input
          id={fieldId}
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
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-editar-contador-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="modal-editar-contador-titulo" className="text-sm font-bold text-white">Editar Escritório</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
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

          <div>
            <label htmlFor="editar-provider-assinatura" className="block text-[11px] font-medium text-slate-400 mb-1">Provedor de Assinatura *</label>
            <select
              id="editar-provider-assinatura"
              name="providerAssinatura"
              value={form.providerAssinatura}
              onChange={(e) => setForm((f) => ({ ...f, providerAssinatura: e.target.value as ProviderAssinatura }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="INTERNO">Interno (FiscoHub)</option>
              <option value="ZAPSIGN">ZapSign</option>
            </select>
          </div>

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
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalRef.current) modalRef.current.focus(); }, []);

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
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-asaas-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="modal-asaas-titulo" className="text-sm font-bold text-white">Integração Asaas</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
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
            <label htmlFor="asaas-apikey" className="block text-[11px] font-medium text-slate-400 mb-1">
              API Key do Asaas
              <span className="text-slate-600 ml-1">(deixe vazio para remover)</span>
            </label>
            <input
              id="asaas-apikey"
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
// Modal Cora — configura credenciais mTLS por contador
// =============================================================================

interface ModalCoraProps {
  contador: ContadorDTO;
  onClose:  () => void;
  onSalvo:  (configurado: boolean) => void;
  token:    string;
}

function ModalCora({ contador, onClose, onSalvo, token }: ModalCoraProps) {
  const [clientId,       setClientId]       = useState('');
  const [certificatePem, setCertificatePem] = useState('');
  const [privateKeyPem,  setPrivateKeyPem]  = useState('');
  const [salvando,       setSalvando]       = useState(false);
  const [erro,           setErro]           = useState('');
  const [sucesso,        setSucesso]        = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalRef.current) modalRef.current.focus(); }, []);

  const limparMsgs = () => { setErro(''); setSucesso(''); };

  const handleSalvar = async () => {
    limparMsgs();
    if (!clientId.trim()) { setErro('Client ID é obrigatório.'); return; }
    if (!certificatePem.trim()) { setErro('Certificado PEM é obrigatório.'); return; }
    if (!privateKeyPem.trim())  { setErro('Chave privada PEM é obrigatória.'); return; }

    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/cora`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          clientId:       clientId.trim(),
          certificatePem: certificatePem.trim(),
          privateKeyPem:  privateKeyPem.trim(),
        }),
      });
      const data = await res.json() as { ok?: boolean; message?: string; configurado?: boolean };
      if (!res.ok) { setErro(data.message ?? `Erro HTTP ${res.status}`); return; }
      setSucesso('Credenciais Cora salvas e validadas!');
      onSalvo(true);
      setTimeout(onClose, 1200);
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async () => {
    limparMsgs();
    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/cora`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); setErro(d.message ?? 'Erro.'); return; }
      setSucesso('Credenciais Cora removidas.');
      onSalvo(false);
      setTimeout(onClose, 1200);
    } catch {
      setErro('Erro de rede.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cora-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl focus:outline-none"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="modal-cora-titulo" className="text-sm font-bold text-white">Integração Cora</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status atual */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${contador.coraConfigurado ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            <span className={`w-2 h-2 rounded-full ${contador.coraConfigurado ? 'bg-primary' : 'bg-slate-500'}`} />
            {contador.coraConfigurado ? 'Cora configurado — boletos reais ativos' : 'Sem credenciais — usando PDF local (fallback)'}
          </div>

          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 text-[11px] text-amber-300">
            A Cora exige autenticação mTLS: você precisa do <strong>Client ID</strong>, do <strong>certificado TLS</strong> (arquivo .pem) e da <strong>chave privada</strong> (.key) gerados no portal Cora.
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

          {/* Client ID */}
          <div>
            <label htmlFor="cora-clientid" className="block text-[11px] font-medium text-slate-400 mb-1">Client ID *</label>
            <input
              id="cora-clientid"
              type="text"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); limparMsgs(); }}
              placeholder="seu-client-id-cora"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* Certificado PEM */}
          <div>
            <label htmlFor="cora-certificate" className="block text-[11px] font-medium text-slate-400 mb-1">
              Certificado TLS (PEM) *
            </label>
            <textarea
              id="cora-certificate"
              value={certificatePem}
              onChange={(e) => { setCertificatePem(e.target.value); limparMsgs(); }}
              placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary font-mono resize-none"
            />
          </div>

          {/* Chave privada PEM */}
          <div>
            <label htmlFor="cora-clientsecret" className="block text-[11px] font-medium text-slate-400 mb-1">
              Chave Privada (PEM) *
            </label>
            <textarea
              id="cora-clientsecret"
              value={privateKeyPem}
              onChange={(e) => { setPrivateKeyPem(e.target.value); limparMsgs(); }}
              placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary font-mono resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          {contador.coraConfigurado && (
            <button
              type="button"
              onClick={handleRemover}
              disabled={salvando}
              className="px-4 py-2 text-xs font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 rounded-lg transition-colors disabled:opacity-50"
            >
              Remover
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
            disabled={salvando || !clientId.trim() || !certificatePem.trim() || !privateKeyPem.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark disabled:opacity-50 rounded-lg transition-colors"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {salvando ? 'Validando…' : 'Salvar credenciais'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Modal IA — configura provider/chave de IA por contador
// =============================================================================

interface ModalIaProps {
  contador: ContadorDTO;
  onClose:  () => void;
  onSalvo:  (iaPersonalizada: boolean, iaProvider: string | null) => void;
  token:    string;
}

function ModalIa({ contador, onClose, onSalvo, token }: ModalIaProps) {
  const [usarPadrao,  setUsarPadrao]  = useState(!contador.iaPersonalizada);
  const [provider,    setProvider]    = useState<IaProvider>((contador.iaProvider as IaProvider) ?? 'anthropic');
  const [apiKey,      setApiKey]      = useState('');
  const [mostrarKey,  setMostrarKey]  = useState(false);
  const [salvando,    setSalvando]    = useState(false);
  const [removendo,   setRemovendo]   = useState(false);
  const [erro,        setErro]        = useState('');
  const [sucesso,     setSucesso]     = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalRef.current) modalRef.current.focus(); }, []);

  const KEY_LINKS: Record<IaProvider, string> = {
    anthropic: 'console.anthropic.com',
    openai:    'platform.openai.com/api-keys',
    google:    'aistudio.google.com/app/apikey',
    deepseek:  'platform.deepseek.com',
  };

  const handleSalvar = async () => {
    setErro(''); setSucesso('');
    if (!usarPadrao && !apiKey && !contador.iaPersonalizada) {
      setErro('Informe a chave de API.'); return;
    }
    setSalvando(true);
    try {
      const body = usarPadrao
        ? { clear: true }
        : { iaProvider: provider, iaApiKey: apiKey.trim() || undefined };
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/ia`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; message?: string; iaPersonalizada?: boolean };
      if (!res.ok) { setErro(data.message ?? 'Erro ao salvar.'); return; }
      setSucesso(usarPadrao ? 'Revertido para o padrão do sistema.' : `IA personalizada: ${provider}`);
      onSalvo(data.iaPersonalizada ?? false, usarPadrao ? null : provider);
      setTimeout(onClose, 1100);
    } catch {
      setErro('Erro de rede.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async () => {
    setErro(''); setSucesso('');
    setRemovendo(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/ia`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ clear: true }),
      });
      if (!res.ok) { const d = await res.json(); setErro(d.message ?? 'Erro.'); return; }
      setSucesso('Personalização removida — usando padrão do sistema.');
      onSalvo(false, null);
      setTimeout(onClose, 1100);
    } catch {
      setErro('Erro de rede.');
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-ia-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="modal-ia-titulo" className="text-sm font-bold text-white">IA do Calendário Fiscal</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
            contador.iaPersonalizada
              ? 'bg-violet-900/20 text-violet-300 border-violet-700/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <Bot size={13} className={contador.iaPersonalizada ? 'text-violet-400' : 'text-slate-500'} />
            {contador.iaPersonalizada
              ? `IA personalizada: ${contador.iaProvider ?? 'configurada'}`
              : 'Usando padrão do sistema (configurado em admin-config)'}
          </div>

          {erro && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{erro}</p>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">{sucesso}</p>
            </div>
          )}

          {/* Escolha: padrão ou personalizado */}
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${usarPadrao ? 'border-slate-600 bg-slate-800' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
              <input
                type="radio"
                checked={usarPadrao}
                onChange={() => setUsarPadrao(true)}
                className="accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">Padrão do sistema</p>
                <p className="text-[11px] text-slate-400">Usa a IA configurada em Configurações do admin</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!usarPadrao ? 'border-violet-500 bg-violet-900/20' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
              <input
                type="radio"
                checked={!usarPadrao}
                onChange={() => setUsarPadrao(false)}
                className="accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">IA personalizada</p>
                <p className="text-[11px] text-slate-400">Provider e chave exclusivos para este cliente</p>
              </div>
            </label>
          </div>

          {/* Config personalizada */}
          {!usarPadrao && (
            <>
              <fieldset>
                <legend className="block text-[11px] font-medium text-slate-400 mb-2">
                  Provedor de IA
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {IA_PROVIDERS.map((p) => (
                    <label key={p.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${provider === p.id ? 'border-violet-500 bg-violet-900/20' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}>
                      <input
                        type="radio"
                        name="iaProvider"
                        value={p.id}
                        checked={provider === p.id}
                        onChange={() => setProvider(p.id)}
                        className="mt-0.5 accent-violet-500"
                      />
                      <div>
                        <p className="text-xs font-medium text-white">{p.label}</p>
                        <p className="text-[10px] text-slate-500">{p.modelLabel}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <label htmlFor="ia-apikey" className="block text-[11px] font-medium text-slate-400">
                  Chave de API
                  {contador.iaPersonalizada && <span className="text-slate-500 font-normal ml-1">(deixe em branco para manter)</span>}
                </label>
                <div className="relative">
                  <input
                    id="ia-apikey"
                    type={mostrarKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={contador.iaPersonalizada ? '••••••••••••••••' : 'sk-ant-... / sk-... / AIza...'}
                    autoComplete="off"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarKey((v) => !v)}
                    aria-label={mostrarKey ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {mostrarKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Obtenha em: <span className="text-violet-400">{KEY_LINKS[provider]}</span>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-5">
          {contador.iaPersonalizada && (
            <button
              type="button"
              onClick={handleRemover}
              disabled={removendo || salvando}
              className="px-4 py-2 text-xs font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 rounded-lg transition-colors disabled:opacity-50"
            >
              {removendo ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              Remover
            </button>
          )}
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || removendo}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Modal Plano — altera o plano SaaS de um contador
// =============================================================================

const STATUS_OPTS = ['TRIAL', 'ATIVO', 'INADIMPLENTE', 'SUSPENSO', 'CANCELADO'] as const;
const STATUS_CORES: Record<string, string> = {
  TRIAL:        'text-primary',
  ATIVO:        'text-emerald-400',
  INADIMPLENTE: 'text-orange-400',
  SUSPENSO:     'text-yellow-400',
  CANCELADO:    'text-red-400',
};

interface ModalPlanoProps {
  contador: ContadorDTO;
  onClose:  () => void;
  onSalvo:  (planoNome: string, status: string, planoId: string) => void;
  token:    string;
}

const DATA_PERMANENTE = '2099-12-31T00:00:00.000Z';
const isPermanente = (dataRenovacao: string | null) =>
  dataRenovacao ? new Date(dataRenovacao).getFullYear() >= 2090 : false;

function ModalPlano({ contador, onClose, onSalvo, token }: ModalPlanoProps) {
  const [planos,      setPlanos]      = useState<PlanoDTO[]>([]);
  const [planoId,     setPlanoId]     = useState(contador.planoId ?? '');
  const [status,      setStatus]      = useState(contador.statusAssinatura ?? 'TRIAL');
  const [permanente,  setPermanente]  = useState(() => isPermanente(contador.dataRenovacao));
  const [carregando,  setCarregando]  = useState(true);
  const [salvando,    setSalvando]    = useState(false);
  const [erro,        setErro]        = useState('');
  const [sucesso,     setSucesso]     = useState('');

  useEffect(() => {
    fetch('/api/v1/planos')
      .then((r) => r.json())
      .then((d) => { setPlanos(d.planos ?? []); setCarregando(false); })
      .catch(() => setCarregando(false));
  }, []);

  const handleSalvar = async () => {
    if (!planoId) { setErro('Selecione um plano.'); return; }
    setErro('');
    setSalvando(true);
    try {
      const body: Record<string, string> = { planoId, status };
      if (permanente) body.dataRenovacao = DATA_PERMANENTE;
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/plano`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; message?: string; planoNome?: string };
      if (!res.ok) { setErro(data.message ?? 'Erro ao salvar.'); return; }
      setSucesso(`Plano atualizado para ${data.planoNome} (${status}${permanente ? ' · Permanente' : ''}).`);
      onSalvo(data.planoNome ?? '', status, planoId);
      setTimeout(onClose, 1200);
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white">Alterar Plano</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{erro}</p>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">{sucesso}</p>
            </div>
          )}

          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-2">Plano</label>
                <div className="space-y-2">
                  {planos.map((p) => (
                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${planoId === p.id ? 'border-violet-500 bg-violet-900/20' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}>
                      <input
                        type="radio"
                        name="plano"
                        value={p.id}
                        checked={planoId === p.id}
                        onChange={() => setPlanoId(p.id)}
                        className="accent-violet-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{p.nome}</p>
                      </div>
                      <span className="text-xs font-mono text-slate-300">
                        R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-2">Status da assinatura</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${permanente ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}>
                <input
                  type="checkbox"
                  checked={permanente}
                  onChange={(e) => setPermanente(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-white">Acesso permanente</p>
                  <p className="text-[11px] text-slate-400">Sem vencimento — usa o plano gratuitamente para sempre</p>
                </div>
              </label>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              Fechar
            </button>
            <button type="button" onClick={handleSalvar} disabled={salvando || carregando || !planoId}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              {salvando ? 'Salvando…' : 'Salvar plano'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Modal Alterar Senha
// =============================================================================

interface ModalAlterarSenhaProps {
  contador: ContadorDTO;
  onClose:  () => void;
  token:    string;
}

function ModalAlterarSenha({ contador, onClose, token }: ModalAlterarSenhaProps) {
  const [novaSenha,    setNovaSenha]    = useState('');
  const [confirmar,    setConfirmar]    = useState('');
  const [mostrar,      setMostrar]      = useState(false);
  const [salvando,     setSalvando]     = useState(false);
  const [erro,         setErro]         = useState('');
  const [sucesso,      setSucesso]      = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalRef.current) modalRef.current.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (novaSenha.length < 8) { setErro('A senha deve ter ao menos 8 caracteres.'); return; }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem.'); return; }

    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/admin/contadores/${contador.id}/senha`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ novaSenha }),
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok) { setErro(data.message ?? `Erro HTTP ${res.status}`); return; }
      setSucesso('Senha redefinida com sucesso!');
      setTimeout(onClose, 1200);
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-senha-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="modal-senha-titulo" className="text-sm font-bold text-white">Redefinir Senha</h2>
            <p className="text-xs text-slate-400 mt-0.5">{contador.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{erro}</p>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">{sucesso}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="senha-nova" className="block text-[11px] font-medium text-slate-400 mb-1">Nova senha *</label>
              <div className="relative">
                <input
                  id="senha-nova"
                  type={mostrar ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => { setNovaSenha(e.target.value); setErro(''); }}
                  placeholder="mín. 8 caracteres"
                  autoComplete="new-password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {mostrar ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="senha-confirmar" className="block text-[11px] font-medium text-slate-400 mb-1">Confirmar senha *</label>
              <input
                id="senha-confirmar"
                type={mostrar ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => { setConfirmar(e.target.value); setErro(''); }}
                placeholder="repita a senha"
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg transition-colors">
              {salvando && <Loader2 size={13} className="animate-spin" />}
              {salvando ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Página principal
// =============================================================================

export default function ContadoresPage() {
  const { getToken, token, iniciarImpersonacao } = useAuth();
  const router = useRouter();

  const [contadores,    setContadores]    = useState<ContadorDTO[]>([]);
  const [carregando,    setCarregando]    = useState(true);
  const [erro,          setErro]          = useState<string | null>(null);
  const [modalAberto,   setModalAberto]   = useState(false);
  const [busca,         setBusca]         = useState('');
  const [toggling,      setToggling]      = useState<string | null>(null); // id do row em transição
  const [impersonando,  setImpersonando]  = useState<string | null>(null);  // id do row em impersonação
  const [modalAsaas,    setModalAsaas]    = useState<ContadorDTO | null>(null);
  const [modalCora,     setModalCora]     = useState<ContadorDTO | null>(null);
  const [modalEditar,   setModalEditar]   = useState<ContadorDTO | null>(null);
  const [modalPlano,    setModalPlano]    = useState<ContadorDTO | null>(null);
  const [modalIa,       setModalIa]       = useState<ContadorDTO | null>(null);
  const [modalSenha,    setModalSenha]    = useState<ContadorDTO | null>(null);

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
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar status.');
    } finally {
      setToggling(null);
    }
  }, [getToken]);

  // Impersonação
  const handleImpersonar = useCallback(async (c: ContadorDTO) => {
    setImpersonando(c.id);
    try {
      const tkn = await getToken();
      const res = await fetch(`/api/v1/admin/contadores/${c.id}/impersonar`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${tkn}` },
      });
      const data = await res.json() as { token?: string; message?: string };
      if (!res.ok) {
        toast.error(data.message ?? `Erro HTTP ${res.status}`);
        return;
      }
      iniciarImpersonacao(data.token!);
      router.push('/dashboard');
    } catch {
      toast.error('Erro de rede ao tentar impersonar.');
    } finally {
      setImpersonando(null);
    }
  }, [getToken, iniciarImpersonacao, router]);

  // Filtragem por busca
  const contadoresFiltrados = contadores.filter((c) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      c.name.toLowerCase().includes(q)          ||
      c.email.toLowerCase().includes(q)         ||
      (c.crc ?? '').toLowerCase().includes(q)   ||
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
          onCriado={(novo: ContadorDTO) => {
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

      {/* Modal: Cora */}
      {modalCora && (
        <ModalCora
          contador={modalCora}
          token={token ?? ''}
          onClose={() => setModalCora(null)}
          onSalvo={(configurado) => {
            setContadores((prev) =>
              prev.map((c) => c.id === modalCora.id ? { ...c, coraConfigurado: configurado } : c),
            );
          }}
        />
      )}

      {/* Modal: Plano */}
      {modalPlano && (
        <ModalPlano
          contador={modalPlano}
          token={token ?? ''}
          onClose={() => setModalPlano(null)}
          onSalvo={(planoNome, statusAssinatura, planoId) => {
            setContadores((prev) =>
              prev.map((c) => c.id === modalPlano.id ? { ...c, planoNome, statusAssinatura, planoId } : c),
            );
          }}
        />
      )}

      {/* Modal: IA */}
      {modalIa && (
        <ModalIa
          contador={modalIa}
          token={token ?? ''}
          onClose={() => setModalIa(null)}
          onSalvo={(iaPersonalizada, iaProvider) => {
            setContadores((prev) =>
              prev.map((c) => c.id === modalIa.id ? { ...c, iaPersonalizada, iaProvider } : c),
            );
          }}
        />
      )}

      {/* Modal: Alterar Senha */}
      {modalSenha && (
        <ModalAlterarSenha
          contador={modalSenha}
          token={token ?? ''}
          onClose={() => setModalSenha(null)}
        />
      )}

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Clientes</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {carregando ? 'Carregando…' : `${contadores.length} escritório${contadores.length !== 1 ? 's' : ''} contratante${contadores.length !== 1 ? 's' : ''} na plataforma`}
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
            aria-label="Buscar contadores"
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
                      Provedor Pag.
                    </th>
                    <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">
                      Assinatura
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
                            {c.planoNome && (
                              <p className={`text-[10px] font-medium truncate ${STATUS_CORES[c.statusAssinatura ?? ''] ?? 'text-slate-500'}`}>
                                {c.planoNome} · {c.statusAssinatura}
                                {isPermanente(c.dataRenovacao) && (
                                  <span className="ml-1 text-emerald-400">· Permanente</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CRC */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {c.crc ? (
                          <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                            {c.crc}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
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

                      {/* Provedor */}
                      <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                        {c.asaasConfigurado ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-900/30 border-emerald-700/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Asaas
                          </span>
                        ) : c.coraConfigurado ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-primary bg-primary/20 border-primary/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Cora
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-slate-500 bg-slate-800 border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            PDF local
                          </span>
                        )}
                      </td>

                      {/* Assinatura */}
                      <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                        {c.providerAssinatura === 'ZAPSIGN' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-900/30 border-emerald-700/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ZapSign
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-slate-400 bg-slate-800 border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Interno
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Editar */}
                          <button
                            onClick={() => setModalEditar(c)}
                            title="Editar dados"
                            aria-label="Editar contador"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                          >
                            <Pencil size={12} />
                            Editar
                          </button>

                          {/* Senha */}
                          <button
                            onClick={() => setModalSenha(c)}
                            title="Redefinir senha"
                            aria-label="Alterar senha"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                          >
                            <LockKeyhole size={12} />
                            Senha
                          </button>

                          {/* Plano */}
                          <button
                            onClick={() => setModalPlano(c)}
                            title="Alterar plano"
                            aria-label="Gerenciar plano"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              c.planoNome
                                ? 'text-violet-400 bg-violet-900/20 hover:bg-violet-900/40 border-violet-800/40'
                                : 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700'
                            }`}
                          >
                            <CreditCard size={12} />
                            Plano
                          </button>

                          {/* IA */}
                          <button
                            onClick={() => setModalIa(c)}
                            title="Configurar IA do calendário fiscal"
                            aria-label="Configurar IA"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              c.iaPersonalizada
                                ? 'text-fuchsia-400 bg-fuchsia-900/20 hover:bg-fuchsia-900/40 border-fuchsia-800/40'
                                : 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700'
                            }`}
                          >
                            <Bot size={12} />
                            IA
                          </button>

                          {/* Asaas */}
                          <button
                            onClick={() => setModalAsaas(c)}
                            title="Configurar integração Asaas"
                            aria-label="Configurar integração Asaas"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              c.asaasConfigurado
                                ? 'text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40 border-emerald-800/40'
                                : 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700'
                            }`}
                          >
                            <KeyRound size={12} />
                            Asaas
                          </button>

                          {/* Cora */}
                          <button
                            onClick={() => setModalCora(c)}
                            title="Configurar integração Cora"
                            aria-label="Configurar integração Cora"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              c.coraConfigurado
                                ? 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/30'
                                : 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700'
                            }`}
                          >
                            <KeyRound size={12} />
                            Cora
                          </button>

                          {/* Acessar como */}
                          <button
                            onClick={() => handleImpersonar(c)}
                            disabled={impersonando === c.id || !c.isActive}
                            title="Acessar como este contador"
                            aria-label="Acessar como este contador"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border text-amber-400 bg-amber-900/20 hover:bg-amber-900/40 border-amber-800/40 disabled:opacity-40"
                          >
                            {impersonando === c.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <LogIn size={12} />
                            }
                            Acessar como
                          </button>

                          {/* Bloquear/Desbloquear */}
                          <button
                            onClick={() => toggleStatus(c.id, c.isActive)}
                            disabled={toggling === c.id}
                            title={c.isActive ? 'Bloquear acesso' : 'Desbloquear acesso'}
                            aria-label={c.isActive ? 'Bloquear acesso' : 'Desbloquear acesso'}
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
