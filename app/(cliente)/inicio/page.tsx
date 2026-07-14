'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link          from 'next/link';
import {
  CloudUpload, FileText, Download, CheckCircle, CheckCircle2,
  Loader2, AlertTriangle, DollarSign,
  ChevronRight, FileCode2, Bell, Send, CalendarClock,
  Landmark, Receipt, Calculator, Users as UsersIcon, FolderOpen, X,
} from 'lucide-react';

import { useAuth }              from '../../../src/presentation/hooks/useAuth';
import { useDocumentosCliente } from '../../../src/presentation/hooks/useDocumentosCliente';
import { EnvioLoteModal }       from '../../../src/presentation/components/cliente/EnvioLoteModal';

// =============================================================================
// Tipos
// =============================================================================

interface Boleto {
  id:         string;
  valor:      number;
  vencimento: string;
  status:     string;
  descricao?: string;
}

interface Categoria {
  id:       string;
  label:    string;
  descricao: string;
  exemplos: string;
  icon:     React.ElementType;
  accept:   string;
  cor: {
    gradient: string;
    iconBg:   string;
    iconTxt:  string;
    cardBg:   string;
    cardBorder: string;
    cardHover:  string;
  };
}

const CATEGORIAS: Categoria[] = [
  {
    id:       'xml',
    label:    'Arquivos XML',
    descricao: 'Notas fiscais emitidas ou recebidas',
    exemplos: 'NF-e · NFS-e · CT-e',
    icon:     FileCode2,
    accept:   '.xml',
    cor: {
      gradient:    'from-blue-500 to-blue-600',
      iconBg:      'bg-primary/10 dark:bg-primary/20',
      iconTxt:     'text-primary',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-primary/20 dark:border-primary/20',
      cardHover:   'hover:border-primary hover:shadow-primary/10 dark:hover:border-primary',
    },
  },
  {
    id:       'extratos',
    label:    'Extratos Bancários',
    descricao: 'Movimentação da sua conta bancária',
    exemplos: 'PDF · OFX · CSV',
    icon:     Landmark,
    accept:   '.pdf,.ofx,.csv',
    cor: {
      gradient:    'from-emerald-500 to-emerald-600',
      iconBg:      'bg-emerald-100 dark:bg-emerald-900/40',
      iconTxt:     'text-emerald-600 dark:text-emerald-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-emerald-100 dark:border-emerald-900/50',
      cardHover:   'hover:border-emerald-400 hover:shadow-emerald-100 dark:hover:border-emerald-600',
    },
  },
  {
    id:       'despesas',
    label:    'Despesas',
    descricao: 'Comprovantes de pagamentos e gastos',
    exemplos: 'Recibos · Boletos pagos · PDFs',
    icon:     Receipt,
    accept:   '.pdf,.jpg,.jpeg,.png',
    cor: {
      gradient:    'from-orange-500 to-orange-600',
      iconBg:      'bg-orange-100 dark:bg-orange-900/40',
      iconTxt:     'text-orange-600 dark:text-orange-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-orange-100 dark:border-orange-900/50',
      cardHover:   'hover:border-orange-400 hover:shadow-orange-100 dark:hover:border-orange-600',
    },
  },
  {
    id:       'impostos',
    label:    'Impostos',
    descricao: 'Guias e comprovantes de tributos',
    exemplos: 'DARF · DAS · GPS · GNRE',
    icon:     Calculator,
    accept:   '.pdf,.xml',
    cor: {
      gradient:    'from-red-500 to-red-600',
      iconBg:      'bg-red-100 dark:bg-red-900/40',
      iconTxt:     'text-red-600 dark:text-red-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-red-100 dark:border-red-900/50',
      cardHover:   'hover:border-red-400 hover:shadow-red-100 dark:hover:border-red-600',
    },
  },
  {
    id:       'folha',
    label:    'Folha de Pagamento',
    descricao: 'Documentos de funcionários e RH',
    exemplos: 'Holerites · FGTS · Admissão',
    icon:     UsersIcon,
    accept:   '.pdf,.xls,.xlsx',
    cor: {
      gradient:    'from-violet-500 to-violet-600',
      iconBg:      'bg-primary/10 dark:bg-primary/20',
      iconTxt:     'text-primary',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-primary/20 dark:border-primary/20',
      cardHover:   'hover:border-primary hover:shadow-primary/10 dark:hover:border-primary',
    },
  },
  {
    id:       'diversos',
    label:    'Documentos Diversos',
    descricao: 'Outros documentos do seu negócio',
    exemplos: 'Contratos · Alvarás · Qualquer PDF',
    icon:     FolderOpen,
    accept:   '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xml',
    cor: {
      gradient:    'from-slate-500 to-slate-600',
      iconBg:      'bg-slate-100 dark:bg-slate-800',
      iconTxt:     'text-slate-600 dark:text-slate-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-slate-200 dark:border-slate-700',
      cardHover:   'hover:border-slate-400 hover:shadow-slate-100 dark:hover:border-slate-500',
    },
  },
];

// =============================================================================
// Helpers
// =============================================================================

const MESES  = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

const SETOR_BADGE: Record<string, { label: string; classe: string }> = {
  FISCAL:   { label: 'Fiscal',      classe: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
  PESSOAL:  { label: 'Dep. Pessoal',classe: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
  CONTABIL: { label: 'Contábil',    classe: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800'   },
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =============================================================================
// Página /inicio — Dashboard do Cliente
// =============================================================================

export default function InicioPagina() {
  const router = useRouter();
  const { usuario, token, carregando: authCarregando, isCliente, isFuncionarioCliente, getToken } = useAuth();

  useEffect(() => {
    if (authCarregando) return;
    if (!usuario || (!isCliente && !isFuncionarioCliente)) router.push('/login');
  }, [authCarregando, usuario, isCliente, isFuncionarioCliente, router]);

  // ── Documentos ─────────────────────────────────────────────────────────────
  const { documentos, carregando: docsCarregando, baixarDocumento, baixandoIds, revalidar } =
    useDocumentosCliente();

  // ── Upload ──────────────────────────────────────────────────────────────────
  const inputRef         = useRef<HTMLInputElement>(null);
  const [catAtiva, setCatAtiva] = useState<Categoria | null>(null);
  const [arquivosModal,  setArquivosModal]  = useState<File[]>([]);
  const [toastUpload,    setToastUpload]    = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  const handleCardClick = (cat: Categoria) => {
    setCatAtiva(cat);
    if (inputRef.current) {
      inputRef.current.accept = cat.accept;
      inputRef.current.value  = '';
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && catAtiva) {
      setArquivosModal(files);
    }
  };

  const fecharModal = () => setArquivosModal([]);

  const aoEnviarComSucesso = () => {
    fecharModal();
    setToastUpload({ tipo: 'sucesso', msg: 'Documentos enviados! Seu contador já foi notificado.' });
    revalidar();
  };

  useEffect(() => {
    if (!toastUpload) return;
    const t = setTimeout(() => setToastUpload(null), 5000);
    return () => clearTimeout(t);
  }, [toastUpload]);

  // ── Boletos ─────────────────────────────────────────────────────────────────
  const [boletos,           setBoletos]           = useState<Boleto[]>([]);
  const [boletosCarregando, setBoletosCarregando] = useState(true);
  const [boletosErro,       setBoletosErro]       = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/financeiro/boletos?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setBoletos(d.boletos ?? []))
      .catch(() => setBoletosErro(true))
      .finally(() => setBoletosCarregando(false));
  }, [token]);

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const agora = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [abaContador, setAbaContador] = useState<'todos' | 'novos'>('todos');

  const docsDoContador  = useMemo(() => documentos.filter(d => d.origem === 'UPLOAD_CONTADOR').slice(0, 6), [documentos]);
  const novosDoContador = useMemo(() => docsDoContador.filter(d => !d.readStatus).length, [docsDoContador]);
  const docsVisiveis    = useMemo(
    () => abaContador === 'novos' ? docsDoContador.filter(d => !d.readStatus) : docsDoContador,
    [abaContador, docsDoContador],
  );

  const boletosAbertos = useMemo(
    () => boletos.filter(b => b.status === 'PENDENTE' || b.status === 'VENCIDO'),
    [boletos],
  );
  const boletosVencidos = useMemo(
    () => boletosAbertos.filter(b => { const d = new Date(b.vencimento); d.setHours(0,0,0,0); return d < agora; }),
    [boletosAbertos, agora],
  );
  const valorAberto = useMemo(() => boletosAbertos.reduce((s, b) => s + b.valor, 0), [boletosAbertos]);

  const proximoVencimento = useMemo(() => {
    const futuros = boletos
      .filter(b => b.status === 'PENDENTE')
      .map(b => { const d = new Date(b.vencimento); d.setHours(0,0,0,0); return d; })
      .filter(d => d >= agora)
      .sort((a, b) => a.getTime() - b.getTime());
    return futuros[0] ?? null;
  }, [boletos, agora]);

  const diasAteVencer = proximoVencimento
    ? Math.ceil((proximoVencimento.getTime() - agora.getTime()) / 86_400_000)
    : null;

  const enviadosMes = useMemo(() => {
    const mes = agora.getMonth(); const ano = agora.getFullYear();
    return documentos.filter(d => {
      if (d.origem !== 'UPLOAD_CLIENTE') return false;
      const dt = new Date(d.createdAt);
      return dt.getMonth() === mes && dt.getFullYear() === ano;
    }).length;
  }, [documentos, agora]);


  // ── Marcar como lido ────────────────────────────────────────────────────────
  const [marcandoIds, setMarcandoIds] = useState<Set<string>>(new Set());
  const marcarComoLido = useCallback(async (id: string) => {
    setMarcandoIds(p => new Set([...p, id]));
    try {
      await fetch(`/api/v1/documentos/${id}/lido`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      setMarcandoIds(p => { const n = new Set(p); n.delete(id); return n; });
      revalidar();
    }
  }, [token, revalidar]);

  // ── Guard ───────────────────────────────────────────────────────────────────
  if (authCarregando || !usuario) return null;

  // ── Saudação contextual ────────────────────────────────────────────────────
  const hora        = new Date().getHours();
  const saudacao    = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = usuario.nome.split(' ')[0];
  const hoje         = new Date();
  const dataFormatada = `${SEMANA[hoje.getDay()]}, ${hoje.getDate()} de ${MESES[hoje.getMonth()]}`;

  const carregando = docsCarregando || boletosCarregando;

  // ============================================================================
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Saudação + Mini-stats ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {saudacao}, {primeiroNome}!
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{dataFormatada}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center gap-2">
          {/* Novos docs */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
            novosDoContador > 0
              ? 'bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            <Bell size={14} className={`shrink-0 ${novosDoContador > 0 ? 'text-primary' : 'text-gray-400'}`} />
            <div>
              <p className={`text-sm font-bold leading-none ${novosDoContador > 0 ? 'text-primary-dark dark:text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                {docsCarregando ? '—' : novosDoContador}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">Docs novos</p>
            </div>
          </div>

          {/* Boletos */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
            boletosVencidos.length > 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : boletosAbertos.length > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            <DollarSign size={14} className={`shrink-0 ${
              boletosVencidos.length > 0 ? 'text-red-500' :
              boletosAbertos.length > 0 ? 'text-amber-500' : 'text-gray-400'
            }`} />
            <div>
              <p className={`text-sm font-bold leading-none ${
                boletosVencidos.length > 0 ? 'text-red-700 dark:text-red-400' :
                boletosAbertos.length > 0 ? 'text-amber-700 dark:text-amber-400' :
                'text-gray-700 dark:text-gray-300'
              }`}>
                {boletosCarregando ? '—' : boletosAbertos.length > 0 ? formatarMoeda(valorAberto) : 'R$ 0'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                {boletosVencidos.length > 0
                  ? `${boletosVencidos.length} vencido${boletosVencidos.length > 1 ? 's' : ''}`
                  : boletosAbertos.length > 0
                    ? `${boletosAbertos.length} em aberto`
                    : 'Sem boletos'}
              </p>
            </div>
          </div>

          {/* Enviados */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <Send size={14} className={`shrink-0 ${enviadosMes > 0 ? 'text-emerald-500' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-bold leading-none text-gray-700 dark:text-gray-300">
                {docsCarregando ? '—' : enviadosMes}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">Enviados/mês</p>
            </div>
          </div>

          {/* Vencimento */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
            diasAteVencer !== null && diasAteVencer <= 5
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            <CalendarClock size={14} className={`shrink-0 ${diasAteVencer !== null && diasAteVencer <= 5 ? 'text-amber-500' : 'text-primary'}`} />
            <div>
              <p className={`text-sm font-bold leading-none ${
                diasAteVencer !== null && diasAteVencer <= 5
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {boletosCarregando ? '—' : diasAteVencer === null ? '—' : diasAteVencer === 0 ? 'Hoje' : `${diasAteVencer}d`}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                {proximoVencimento ? `Venc. ${formatarData(proximoVencimento.toISOString())}` : 'Sem vencimento'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Input file oculto — reutilizado por todos os cards */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modal de envio */}
      {arquivosModal.length > 0 && (
        <EnvioLoteModal
          arquivos={arquivosModal}
          categoriaId={catAtiva?.id}
          onFechar={fecharModal}
          onSucesso={aoEnviarComSucesso}
        />
      )}

      {/* Toast de Upload */}
      {toastUpload && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3 rounded-xl shadow-lg border p-4 pr-3 bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toastUpload.msg}</p>
            <button type="button" onClick={() => setToastUpload(null)} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">

        {/* ============================================================== */}
        {/* COLUNA ESQUERDA — "Do seu Contador"                             */}
        {/* ============================================================== */}
        <section className="lg:col-span-3 space-y-4 order-2 lg:order-1">

          {/* Erro ao carregar boletos */}
          {boletosErro && (
            <p className="text-xs text-red-400">Não foi possível carregar os boletos.</p>
          )}

          {/* Alerta de boletos vencidos — compacto, não alarmante */}
          {!boletosCarregando && boletosVencidos.length > 0 && (
            <Link
              href="/financeiro"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors group"
            >
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400 flex-1">
                <span className="font-semibold">
                  {boletosVencidos.length} boleto{boletosVencidos.length > 1 ? 's' : ''} vencido{boletosVencidos.length > 1 ? 's'  : ''}
                </span>
                {' · '}{formatarMoeda(boletosVencidos.reduce((s, b) => s + b.valor, 0))} em aberto
              </p>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 group-hover:underline shrink-0">
                Ver boletos →
              </span>
            </Link>
          )}

          {/* Documentos do contador */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
            <div className={`px-5 py-4 flex items-center justify-between ${docsCarregando || docsDoContador.length > 0 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FolderOpen size={15} className="text-primary" />
                  Do seu Contador
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Documentos enviados pelo escritório</p>
              </div>
              <Link
                href="/documentos"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium shrink-0"
              >
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>

            {/* Loading */}
            {docsCarregando && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-gray-500">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Carregando…
              </div>
            )}

            {/* Nenhum documento ainda */}
            {!docsCarregando && docsDoContador.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <FolderOpen size={26} className="text-primary/70" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Nenhum documento ainda</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed max-w-[190px] mx-auto">
                    Quando seu contador enviar documentos, eles aparecerão aqui.
                  </p>
                </div>
              </div>
            )}

            {/* Filtro Todos / Novos */}
            {!docsCarregando && docsDoContador.length > 0 && (
              <div className="flex items-center gap-1 px-5 py-2 border-b border-gray-100 dark:border-gray-800">
                {(['todos', 'novos'] as const).map((aba) => (
                  <button
                    key={aba}
                    type="button"
                    onClick={() => setAbaContador(aba)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      abaContador === aba
                        ? 'bg-primary text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {aba === 'todos' ? 'Todos' : 'Novos'}
                    {aba === 'novos' && novosDoContador > 0 && (
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold leading-none ${
                        abaContador === 'novos' ? 'bg-white/30 text-white' : 'bg-primary text-white'
                      }`}>
                        {novosDoContador}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Todos lidos no filtro "Novos" */}
            {!docsCarregando && docsDoContador.length > 0 && docsVisiveis.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tudo em dia!</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Nenhum documento pendente de leitura.</p>
              </div>
            )}

            {/* Lista de documentos */}
            {!docsCarregando && docsVisiveis.length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {docsVisiveis.map(doc => {
                  const setor     = SETOR_BADGE[doc.sector];
                  const isPDF     = doc.fileType === 'PDF';
                  const isBaixando = baixandoIds.has(doc.id);
                  const isMarcando = marcandoIds.has(doc.id);

                  return (
                    <li
                      key={doc.id}
                      className={`flex items-center gap-3 px-5 py-3.5 transition-colors
                        ${!doc.readStatus ? 'hover:bg-primary/10 dark:hover:bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      {/* Ícone colorido pelo setor */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                        ${doc.sector === 'FISCAL'   ? 'bg-indigo-50 dark:bg-indigo-900/30' :
                          doc.sector === 'PESSOAL'  ? 'bg-violet-50 dark:bg-violet-900/30' :
                          doc.sector === 'CONTABIL' ? 'bg-teal-50 dark:bg-teal-900/30'   : 'bg-gray-100 dark:bg-gray-800'}`}
                      >
                        {isPDF
                          ? <FileText  size={15} className={
                              doc.sector === 'FISCAL'   ? 'text-indigo-500' :
                              doc.sector === 'PESSOAL'  ? 'text-violet-500' :
                              doc.sector === 'CONTABIL' ? 'text-teal-500'   : 'text-gray-400'} />
                          : <FileCode2 size={15} className="text-primary" />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm truncate max-w-[260px] ${!doc.readStatus ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                            {doc.fileName}
                          </p>
                          {!doc.readStatus && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px]
                              font-bold bg-primary text-white leading-none">
                              NOVO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatarData(doc.createdAt)}</span>
                          {setor && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md
                              text-[9px] font-bold uppercase border ${setor.classe}`}>
                              {setor.label}
                            </span>
                          )}
                          {doc.readStatus && doc.readAt && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                              <CheckCircle2 size={9} /> Lido
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!doc.readStatus && (
                          <button
                            onClick={() => marcarComoLido(doc.id)}
                            disabled={isMarcando || isBaixando}
                            title="Marcar como lido"
                            aria-label="Marcar como lido"
                            className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                              disabled:opacity-40 transition-colors"
                          >
                            {isMarcando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={14} aria-hidden="true" />}
                          </button>
                        )}
                        <button
                          onClick={() => baixarDocumento(doc.id)}
                          disabled={isBaixando || isMarcando}
                          title="Baixar"
                          aria-label="Baixar"
                          className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/10
                            disabled:opacity-40 transition-colors"
                        >
                          {isBaixando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Rodapé — todos lidos */}
            {!docsCarregando && docsDoContador.length > 0 && novosDoContador === 0 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-emerald-50/60 dark:bg-emerald-900/10 flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <p className="text-xs text-emerald-700 font-medium">Todos os documentos estão lidos.</p>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* COLUNA DIREITA — Upload Compacto                                 */}
        {/* ============================================================== */}
        <aside className="lg:col-span-2 order-1 lg:order-2">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CloudUpload size={15} className="text-primary" />
                  Enviar para o Contador
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Selecione a categoria do arquivo
                </p>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3 flex-1">
              {CATEGORIAS.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCardClick(cat)}
                    className={`
                      group relative flex flex-col items-center text-center
                      rounded-xl border-2 p-4
                      transition-all duration-200 cursor-pointer
                      hover:shadow-md hover:-translate-y-0.5 active:scale-95
                      ${cat.cor.cardBg} ${cat.cor.cardBorder} ${cat.cor.cardHover}
                    `}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 transition-transform duration-200 group-hover:scale-110 bg-gradient-to-br ${cat.cor.gradient}`}>
                      <Icon size={18} className="text-white" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                      {cat.label}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mb-1.5">
                      {cat.descricao}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-tight font-medium">
                      {cat.exemplos}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
}
