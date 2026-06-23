'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

// =============================================================================
// Tipos
// =============================================================================

export interface ClienteFormData {
  id?:              string;
  nome:             string;
  email:            string;
  cnpj:             string;
  phone:            string;
  cnae?:            string;
  regimeTributario?: string;
}

interface ClienteModalProps {
  aberto:       boolean;
  onFechar:     () => void;
  /** Se definido, o modal entra em modo Edição. Se null/undefined, modo Criação. */
  dadosIniciais?: ClienteFormData | null;
  token:        string;
  /** Chamado após criação/edição com sucesso — o componente pai deve revalidar. */
  onSucesso:    () => void;
}

// =============================================================================
// Validação CNPJ inline (algoritmo Receita Federal)
// =============================================================================

function cnpjValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;

  const calcDV = (parcial: string, pesos: number[]): number => {
    const soma = parcial.split('').reduce((a, d, i) => a + parseInt(d, 10) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  if (parseInt(digitos[12], 10) !== calcDV(digitos.slice(0, 12), p1)) return false;
  if (parseInt(digitos[13], 10) !== calcDV(digitos.slice(0, 13), p2)) return false;
  return true;
}

// =============================================================================
// Máscara de CNPJ: XX.XXX.XXX/XXXX-XX
// =============================================================================

function mascaraCNPJ(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// =============================================================================
// Máscara de telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
// =============================================================================

function mascaraTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// =============================================================================
// Validação do formulário
// =============================================================================

interface Erros {
  nome?:  string;
  email?: string;
  cnpj?:  string;
}

function validar(dados: ClienteFormData, modoEdicao: boolean): Erros {
  const erros: Erros = {};

  if (!dados.nome.trim() || dados.nome.trim().length < 2) {
    erros.nome = 'Nome deve ter ao menos 2 caracteres.';
  }

  if (!modoEdicao) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!dados.email.trim() || !emailRegex.test(dados.email.trim())) {
      erros.email = 'E-mail inválido.';
    }

    const cnpjDigits = dados.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      erros.cnpj = 'CNPJ deve conter 14 dígitos.';
    } else if (!cnpjValido(cnpjDigits)) {
      erros.cnpj = 'CNPJ com dígitos verificadores inválidos.';
    }
  }

  return erros;
}

// =============================================================================
// ClienteModal
// =============================================================================

export function ClienteModal({
  aberto,
  onFechar,
  dadosIniciais,
  token,
  onSucesso,
}: ClienteModalProps) {
  const modoEdicao = !!dadosIniciais?.id;

  const [form, setForm] = useState<ClienteFormData>({
    nome:             '',
    email:            '',
    cnpj:             '',
    phone:            '',
    cnae:             '',
    regimeTributario: '',
  });

  const [erros, setErros]       = useState<Erros>({});
  const [erroApi, setErroApi]   = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Preenche o form quando abre em modo edição
  useEffect(() => {
    if (aberto) {
      if (dadosIniciais) {
        setForm({
          id:               dadosIniciais.id,
          nome:             dadosIniciais.nome,
          email:            dadosIniciais.email,
          cnpj:             mascaraCNPJ(dadosIniciais.cnpj),
          phone:            dadosIniciais.phone ? mascaraTelefone(dadosIniciais.phone) : '',
          cnae:             dadosIniciais.cnae ?? '',
          regimeTributario: dadosIniciais.regimeTributario ?? '',
        });
      } else {
        setForm({ nome: '', email: '', cnpj: '', phone: '', cnae: '', regimeTributario: '' });
      }
      setErros({});
      setErroApi(null);
      setSalvando(false);
    }
  }, [aberto, dadosIniciais]);

  // Fecha com ESC
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [aberto, onFechar]);

  const handleChange = useCallback(
    (campo: keyof ClienteFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let valor = e.target.value;
      if (campo === 'cnpj')  valor = mascaraCNPJ(valor);
      if (campo === 'phone') valor = mascaraTelefone(valor);
      setForm((prev) => ({ ...prev, [campo]: valor }));
      // Limpa erro do campo ao digitar
      setErros((prev) => ({ ...prev, [campo]: undefined }));
      setErroApi(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const errosLocal = validar(form, modoEdicao);
      if (Object.keys(errosLocal).length > 0) {
        setErros(errosLocal);
        return;
      }

      setSalvando(true);
      setErroApi(null);

      const payload = {
        nome:             form.nome.trim(),
        email:            form.email.trim().toLowerCase(),
        cnpj:             form.cnpj.replace(/\D/g, ''),
        phone:            form.phone.replace(/\D/g, '') || undefined,
        cnae:             form.cnae?.trim() || undefined,
        regimeTributario: form.regimeTributario?.trim() || undefined,
      };

      try {
        const url = modoEdicao
          ? `/api/v1/clientes/${form.id}`
          : '/api/v1/clientes';

        const res = await fetch(url, {
          method:  modoEdicao ? 'PUT' : 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `Erro HTTP ${res.status}`);
        }

        onSucesso();
        onFechar();
      } catch (err) {
        setErroApi(err instanceof Error ? err.message : 'Erro ao salvar cliente.');
      } finally {
        setSalvando(false);
      }
    },
    [form, modoEdicao, token, onSucesso, onFechar],
  );

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cliente-titulo"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onFechar}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
          <h2 id="modal-cliente-titulo" className="text-lg font-bold text-slate-900 dark:text-gray-100">
            {modoEdicao ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Erro geral da API */}
          {erroApi && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{erroApi}</p>
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1.5">
            <label htmlFor="cliente-nome" className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              Razão Social / Nome <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              id="cliente-nome"
              type="text"
              value={form.nome}
              onChange={handleChange('nome')}
              placeholder="Empresa Exemplo Ltda"
              aria-required="true"
              aria-invalid={!!erros.nome}
              aria-describedby={erros.nome ? 'erro-nome' : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500
                bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition-colors
                ${erros.nome ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-slate-300 dark:border-gray-600'}`}
            />
            {erros.nome && <p id="erro-nome" className="text-xs text-red-600">{erros.nome}</p>}
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <label htmlFor="cliente-email" className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              E-mail {!modoEdicao && <span className="text-red-400">*</span>}
            </label>
            {modoEdicao ? (
              <div className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-slate-500 dark:text-gray-400 select-all">
                {form.email}
              </div>
            ) : (
              <input
                id="cliente-email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                placeholder="contato@empresa.com.br"
                aria-required="true"
                aria-invalid={!!erros.email}
                aria-describedby={erros.email ? 'erro-email' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500
                  bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition-colors
                  ${erros.email ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-slate-300 dark:border-gray-600'}`}
              />
            )}
            {erros.email && <p id="erro-email" className="text-xs text-red-600">{erros.email}</p>}
          </div>

          {/* CNPJ */}
          <div className="space-y-1.5">
            <label htmlFor="cliente-cnpj" className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              CNPJ {!modoEdicao && <span className="text-red-400">*</span>}
            </label>
            {modoEdicao ? (
              <div className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-slate-500 dark:text-gray-400 font-mono select-all">
                {form.cnpj}
              </div>
            ) : (
              <input
                id="cliente-cnpj"
                type="text"
                value={form.cnpj}
                onChange={handleChange('cnpj')}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                aria-required="true"
                aria-invalid={!!erros.cnpj}
                aria-describedby={erros.cnpj ? 'erro-cnpj' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500
                  bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition-colors
                  ${erros.cnpj ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-slate-300 dark:border-gray-600'}`}
              />
            )}
            {erros.cnpj && <p id="erro-cnpj" className="text-xs text-red-600">{erros.cnpj}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <label htmlFor="cliente-phone" className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              Telefone
            </label>
            <input
              id="cliente-phone"
              type="text"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="(11) 99999-0000"
              maxLength={15}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-2 text-sm text-slate-900 dark:text-gray-100
                bg-white dark:bg-gray-800 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>

          {/* CNAE */}
          <div className="space-y-1.5">
            <label htmlFor="cliente-cnae" className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              CNAE
            </label>
            <input
              id="cliente-cnae"
              type="text"
              value={form.cnae ?? ''}
              onChange={handleChange('cnae')}
              placeholder="Ex: 6201-5/01"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-2 text-sm text-slate-900 dark:text-gray-100
                bg-white dark:bg-gray-800 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>

          {/* Regime Tributário */}
          <div className="space-y-1.5">
            <label htmlFor="cliente-regime" className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              Regime Tributário
            </label>
            <select
              id="cliente-regime"
              value={form.regimeTributario ?? ''}
              onChange={handleChange('regimeTributario')}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-2 text-sm text-slate-900 dark:text-gray-100
                bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition-colors dark:[color-scheme:dark]"
            >
              <option value="">Não informado</option>
              <option value="MEI">MEI</option>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="ISENTO">Isento</option>
            </select>
          </div>

          {/* Nota sobre senha padrão (apenas Criação) */}
          {!modoEdicao && (
            <p className="text-xs text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              O cliente receberá a senha padrão <strong>mudar@123</strong> para o primeiro acesso.
            </p>
          )}

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700
                transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary
                rounded-lg hover:brightness-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {salvando && <Loader2 size={14} className="animate-spin" />}
              {modoEdicao ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
