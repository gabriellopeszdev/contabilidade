'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CreditCard,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Zap,
  Shield,
  SkipForward,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../src/presentation/hooks/useAuth';
import { FiscoHubLogo } from '../components/FiscoHubLogo';

// =============================================================================
// Tipos
// =============================================================================

type Passo = 1 | 2 | 3 | 4;
type Integracao = 'asaas' | 'pular';

// =============================================================================
// Wizard de Onboarding
// =============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { token, carregando, usuario, isContador } = useAuth();

  const [passo,    setPasso]    = useState<Passo>(1);
  const [salvando, setSalvando] = useState(false);
  const [erro,     setErro]     = useState<string | null>(null);

  // Step 2 — dados do escritório
  const [nomeEscritorio, setNomeEscritorio] = useState('');
  const [cnpj,           setCnpj]           = useState('');

  // Step 3 — integração
  const [integracao,  setIntegracao]  = useState<Integracao | null>(null);
  const [asaasKey,    setAsaasKey]    = useState('');
  const [asaasNome,   setAsaasNome]   = useState<string | null>(null);

  // Guard: redireciona não-contadores
  useEffect(() => {
    if (carregando) return;
    if (!usuario) { router.push('/login'); return; }
    if (!isContador) router.push('/dashboard');
  }, [carregando, usuario, isContador, router]);

  // Se o escritório já estiver configurado, vai direto ao dashboard
  useEffect(() => {
    if (!token || !isContador) return;
    fetch('/api/v1/escritorio/config', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.nomeEscritorio) router.push('/dashboard');
      })
      .catch(() => {});
  }, [token, isContador, router]);

  if (carregando || !usuario) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Ações de persistência
  // ---------------------------------------------------------------------------

  const salvarEscritorio = async (): Promise<boolean> => {
    if (!token) return false;
    setSalvando(true);
    setErro(null);
    try {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const res = await fetch('/api/v1/escritorio/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nomeEscritorio: nomeEscritorio.trim(),
          ...(cnpjLimpo.length === 14 ? { cnpjEscritorio: cnpjLimpo } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.message ?? 'Erro ao salvar escritório.');
        return false;
      }
      return true;
    } catch {
      setErro('Erro de rede. Tente novamente.');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const salvarIntegracao = async (): Promise<boolean> => {
    if (!token || integracao !== 'asaas') return true;
    if (!asaasKey.trim()) { setErro('Informe a chave API do Asaas.'); return false; }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/v1/escritorio/integracao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ asaasApiKey: asaasKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.message ?? 'Chave inválida.'); return false; }
      if (data.nomeEmpresaAsaas) setAsaasNome(data.nomeEmpresaAsaas);
      return true;
    } catch {
      setErro('Erro de rede. Tente novamente.');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Navegação entre passos
  // ---------------------------------------------------------------------------

  const handleProximo = async () => {
    setErro(null);
    if (passo === 1) {
      setPasso(2);
    } else if (passo === 2) {
      if (!nomeEscritorio.trim()) { setErro('Informe o nome do escritório.'); return; }
      const ok = await salvarEscritorio();
      if (ok) setPasso(3);
    } else if (passo === 3) {
      if (!integracao) { setErro('Escolha uma opção ou "Configurar depois".'); return; }
      const ok = await salvarIntegracao();
      if (ok) setPasso(4);
    } else {
      router.push('/dashboard');
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers de formatação CNPJ
  // ---------------------------------------------------------------------------

  const formatarCnpj = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  const PASSOS_LABELS = ['Início', 'Escritório', 'Pagamentos', 'Pronto'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <FiscoHubLogo size="md" />
        </div>

        {/* Progress bar */}
        <div className="flex items-center mb-8 gap-0">
          {PASSOS_LABELS.map((label, i) => {
            const num = (i + 1) as Passo;
            const ativo    = passo === num;
            const concluido = passo > num;
            return (
              <div key={num} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                    ${concluido ? 'bg-blue-600 text-white' : ativo ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}
                  `}>
                    {concluido ? <CheckCircle2 size={14} /> : num}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${ativo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {label}
                  </span>
                </div>
                {i < PASSOS_LABELS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors duration-300 ${concluido ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8">

          {/* ── Passo 1: Boas-vindas ── */}
          {passo === 1 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                <Zap size={36} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Bem-vindo ao FiscoHub!
                </h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Vamos configurar seu escritório em poucos minutos. Você vai precisar do nome do
                  seu escritório e, opcionalmente, sua chave de integração com pagamentos.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: <Building2 size={18} />, label: 'Escritório' },
                  { icon: <CreditCard size={18} />, label: 'Pagamentos' },
                  { icon: <CheckCircle2 size={18} />, label: 'Pronto!' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <span className="text-blue-600 dark:text-blue-400">{item.icon}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Passo 2: Dados do Escritório ── */}
          {passo === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Seu Escritório</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Aparece nos documentos e boletos gerados pela plataforma.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Nome do Escritório <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nomeEscritorio}
                    onChange={(e) => { setNomeEscritorio(e.target.value); setErro(null); }}
                    placeholder="Ex: Contabilidade Silva & Associados"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    CNPJ <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => { setCnpj(formatarCnpj(e.target.value)); setErro(null); }}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Passo 3: Integração de Pagamentos ── */}
          {passo === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <CreditCard size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Integração de Pagamentos</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Integre para emitir boletos e cobranças automaticamente.
                  </p>
                </div>
              </div>

              <div className="space-y-3">

                {/* Asaas */}
                <button
                  onClick={() => { setIntegracao('asaas'); setErro(null); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                    integracao === 'asaas'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <Zap size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Asaas</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Boletos, PIX e cartão de crédito</p>
                  </div>
                  {integracao === 'asaas' && <CheckCircle2 size={18} className="text-blue-600 shrink-0" />}
                </button>

                {/* Asaas key input */}
                {integracao === 'asaas' && (
                  <div className="pl-3 border-l-2 border-blue-200 dark:border-blue-800 ml-2 space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Chave API do Asaas <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={asaasKey}
                      onChange={(e) => { setAsaasKey(e.target.value); setErro(null); }}
                      placeholder="$aact_..."
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400">
                      Acesse: Asaas → Configurações → Chaves API
                    </p>
                  </div>
                )}

                {/* Cora (coming soon) */}
                <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed select-none">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                    <Shield size={20} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Cora</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure em Configurações após o setup</p>
                  </div>
                  <span className="text-[10px] font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full shrink-0">Em breve</span>
                </div>

                {/* Configurar depois */}
                <button
                  onClick={() => { setIntegracao('pular'); setErro(null); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                    integracao === 'pular'
                      ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <SkipForward size={20} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Configurar depois</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Configure em Configurações → Escritório a qualquer momento
                    </p>
                  </div>
                  {integracao === 'pular' && <CheckCircle2 size={18} className="text-gray-500 shrink-0" />}
                </button>
              </div>
            </div>
          )}

          {/* ── Passo 4: Concluído ── */}
          {passo === 4 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tudo pronto!</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {asaasNome
                    ? `Escritório "${nomeEscritorio}" configurado com integração Asaas (${asaasNome}).`
                    : `Escritório "${nomeEscritorio}" configurado com sucesso.`}
                  {' '}Personalize mais em <strong className="text-gray-700 dark:text-gray-300">Configurações</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Mensagem de erro */}
          {erro && (
            <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {erro}
            </div>
          )}

          {/* Botões de navegação */}
          <div className={`mt-8 flex gap-3 ${passo > 1 && passo < 4 ? 'justify-between' : 'justify-center'}`}>
            {passo > 1 && passo < 4 && (
              <button
                onClick={() => { setPasso((passo - 1) as Passo); setErro(null); }}
                disabled={salvando}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <ChevronLeft size={15} />
                Voltar
              </button>
            )}
            <button
              onClick={handleProximo}
              disabled={salvando}
              className="flex items-center gap-2 px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Salvando...
                </>
              ) : passo === 4 ? (
                <>
                  Ir para o Dashboard
                  <ArrowRight size={15} />
                </>
              ) : passo === 1 ? (
                <>
                  Começar
                  <ChevronRight size={15} />
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          Você pode alterar estas configurações a qualquer momento em{' '}
          <span className="font-medium">Configurações</span>.
        </p>
      </div>
    </div>
  );
}
