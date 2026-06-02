'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link          from 'next/link';
import {
  CloudUpload, FileText, Download, CheckCircle, CheckCircle2,
  Loader2, AlertTriangle, DollarSign, MessageSquare, History,
  ChevronRight, Upload,
  FileCode2, Bell, Send, CalendarClock,
} from 'lucide-react';

import { useAuth }              from '../../../src/presentation/hooks/useAuth';
import { useDocumentosCliente } from '../../../src/presentation/hooks/useDocumentosCliente';
import { SectorSelectModal }    from '../../../src/presentation/components/cliente/SectorSelectModal';

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

// =============================================================================
// Helpers
// =============================================================================

const TIPOS_ACEITOS  = '.pdf,.xml,application/pdf,application/xml,text/xml';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

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
  const { usuario, token, carregando: authCarregando, isCliente, isFuncionarioCliente } = useAuth();

  useEffect(() => {
    if (authCarregando) return;
    if (!usuario || (!isCliente && !isFuncionarioCliente)) router.push('/login');
  }, [authCarregando, usuario, isCliente, isFuncionarioCliente, router]);

  // ── Documentos ─────────────────────────────────────────────────────────────
  const { documentos, carregando: docsCarregando, baixarDocumento, baixandoIds, revalidar } =
    useDocumentosCliente();

  // ── Boletos ─────────────────────────────────────────────────────────────────
  const [boletos,           setBoletos]           = useState<Boleto[]>([]);
  const [boletosCarregando, setBoletosCarregando] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/financeiro/boletos?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBoletos(d.boletos ?? []))
      .catch(() => {})
      .finally(() => setBoletosCarregando(false));
  }, [token]);

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const agora = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const docsDoContador  = useMemo(() => documentos.filter(d => d.origem === 'UPLOAD_CONTADOR').slice(0, 6), [documentos]);
  const novosDoContador = useMemo(() => docsDoContador.filter(d => !d.readStatus).length, [docsDoContador]);

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

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const [dragAtivo,          setDragAtivo]          = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [erroArquivo,        setErroArquivo]        = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validar = useCallback((f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'xml') return 'Apenas PDF ou XML são aceitos.';
    if (f.size > MAX_SIZE_BYTES)         return 'Arquivo excede 10 MB.';
    return null;
  }, []);

  const abrirModal = useCallback((f: File) => {
    const e = validar(f);
    if (e) { setErroArquivo(e); return; }
    setErroArquivo(null); setArquivoSelecionado(f);
  }, [validar]);

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragAtivo(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragAtivo(false); }, []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragAtivo(false);
    const f = e.dataTransfer.files[0]; if (f) abrirModal(f);
  }, [abrirModal]);

  const fecharModal        = useCallback(() => { setArquivoSelecionado(null); if (fileInputRef.current) fileInputRef.current.value = ''; }, []);
  const aoEnviarComSucesso = useCallback(() => { fecharModal(); revalidar(); }, [fecharModal, revalidar]);

  // ── Marcar como lido ────────────────────────────────────────────────────────
  const [marcandoIds, setMarcandoIds] = useState<Set<string>>(new Set());
  const marcarComoLido = useCallback(async (id: string) => {
    setMarcandoIds(p => new Set([...p, id]));
    try { await fetch(`/api/v1/documentos/${id}/download`, { headers: { Authorization: `Bearer ${token}` } }); }
    finally { setMarcandoIds(p => { const n = new Set(p); n.delete(id); return n; }); revalidar(); }
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

      {/* ── Saudação ──────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {saudacao}, {primeiroNome}!
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{dataFormatada}</p>
        </div>
        {novosDoContador > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Bell size={13} className="animate-pulse" />
            {novosDoContador} novo{novosDoContador > 1 ? 's' : ''} do contador
          </div>
        )}
      </div>

      {/* ── 4 Cards de status ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Novos documentos */}
        <div className={`rounded-2xl border p-4 space-y-3 transition-colors
          ${novosDoContador > 0
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center
            ${novosDoContador > 0 ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Bell size={16} className={novosDoContador > 0 ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${novosDoContador > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {docsCarregando ? '—' : novosDoContador}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
              {novosDoContador === 1 ? 'Novo doc. do contador' : 'Novos docs. do contador'}
            </p>
          </div>
        </div>

        {/* Boletos em aberto */}
        <div className={`rounded-2xl border p-4 space-y-3 transition-colors
          ${boletosVencidos.length > 0
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : boletosAbertos.length > 0
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center
            ${boletosVencidos.length > 0 ? 'bg-red-100 dark:bg-red-900/40' : boletosAbertos.length > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <DollarSign size={16} className={
              boletosVencidos.length > 0 ? 'text-red-600 dark:text-red-400' :
              boletosAbertos.length  > 0 ? 'text-amber-600 dark:text-amber-400' :
              'text-gray-400'
            } />
          </div>
          <div>
            <p className={`text-2xl font-bold
              ${boletosVencidos.length > 0 ? 'text-red-700 dark:text-red-400' : boletosAbertos.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {boletosCarregando ? '—' : boletosAbertos.length > 0 ? formatarMoeda(valorAberto) : 'R$ 0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
              {boletosVencidos.length > 0
                ? `${boletosVencidos.length} vencido${boletosVencidos.length > 1 ? 's' : ''}`
                : boletosAbertos.length > 0
                  ? `${boletosAbertos.length} em aberto`
                  : 'Sem boletos em aberto'}
            </p>
          </div>
        </div>

        {/* Enviados este mês */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Send size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              {docsCarregando ? '—' : enviadosMes}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
              Enviado{enviadosMes !== 1 ? 's' : ''} por você este mês
            </p>
          </div>
        </div>

        {/* Próximo vencimento */}
        <div className={`rounded-2xl border p-4 space-y-3 transition-colors
          ${diasAteVencer !== null && diasAteVencer <= 5
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center
            ${diasAteVencer !== null && diasAteVencer <= 5 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <CalendarClock size={16} className={diasAteVencer !== null && diasAteVencer <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'} />
          </div>
          <div>
            <p className={`text-2xl font-bold
              ${diasAteVencer !== null && diasAteVencer <= 5 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {boletosCarregando
                ? '—'
                : diasAteVencer === null
                  ? '—'
                  : diasAteVencer === 0
                    ? 'Hoje'
                    : `${diasAteVencer}d`
              }
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
              {proximoVencimento
                ? `Próximo venc. em ${formatarData(proximoVencimento.toISOString())}`
                : 'Sem vencimentos'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ============================================================== */}
        {/* COLUNA ESQUERDA — "Do seu Contador"                             */}
        {/* ============================================================== */}
        <section className="lg:col-span-2 space-y-4">

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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Do seu Contador</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Documentos enviados pelo escritório</p>
              </div>
              <Link
                href="/documentos"
                className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium shrink-0"
              >
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>

            {/* Loading */}
            {docsCarregando && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                Carregando…
              </div>
            )}

            {/* Nenhum documento ainda */}
            {!docsCarregando && docsDoContador.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <FileText size={22} className="text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nenhum documento ainda</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                  Quando seu contador enviar documentos, eles aparecerão aqui.
                </p>
              </div>
            )}

            {/* Lista de documentos */}
            {!docsCarregando && docsDoContador.length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {docsDoContador.map(doc => {
                  const setor     = SETOR_BADGE[doc.sector];
                  const isPDF     = doc.fileType === 'PDF';
                  const isBaixando = baixandoIds.has(doc.id);
                  const isMarcando = marcandoIds.has(doc.id);

                  return (
                    <li
                      key={doc.id}
                      className={`flex items-center gap-3 px-5 py-3.5 transition-colors
                        ${!doc.readStatus ? 'hover:bg-blue-50/40 dark:hover:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
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
                          : <FileCode2 size={15} className="text-sky-400" />
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
                              font-bold bg-blue-500 text-white leading-none">
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
                            className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                              disabled:opacity-40 transition-colors"
                          >
                            {isMarcando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => baixarDocumento(doc.id)}
                          disabled={isBaixando || isMarcando}
                          title="Baixar"
                          className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20
                            disabled:opacity-40 transition-colors"
                        >
                          {isBaixando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
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
        {/* COLUNA DIREITA — Envio + Ações                                  */}
        {/* ============================================================== */}
        <aside className="space-y-4">

          {/* Upload sem seleção de setor */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Enviar Documento</h3>

            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              A classificação do documento será feita pelo seu contador após o envio.
            </p>

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                rounded-xl border-2 border-dashed cursor-pointer select-none
                transition-all duration-200 flex flex-col items-center justify-center
                gap-2 py-7 text-center
                ${dragAtivo
                  ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20 scale-[1.02]'
                  : 'border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-900/10 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={TIPOS_ACEITOS}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) abrirModal(f); }}
              />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                ${dragAtivo ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-sky-100 dark:bg-sky-900/40'}`}>
                <CloudUpload size={20} className="text-sky-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {dragAtivo ? 'Solte aqui!' : 'Arraste ou clique para enviar'}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">PDF ou XML · Máx. 10 MB</p>
              </div>
              {erroArquivo && <p className="text-[10px] text-red-600 font-medium">{erroArquivo}</p>}
            </div>

            {/* Mobile fallback */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs
                font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl
                hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors lg:hidden"
            >
              <Upload size={14} /> Selecionar arquivo
            </button>
          </div>

          {/* Ações Rápidas */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Ações Rápidas</p>

            <Link href="/documentos"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-sky-900/10
                hover:text-sky-700 dark:hover:text-sky-400 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 flex items-center justify-center shrink-0">
                <History size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight">Histórico de Documentos</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Ver todos os arquivos recebidos</p>
              </div>
              <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-sky-400 shrink-0" />
            </Link>

            <Link href="/chat"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-violet-300 hover:bg-violet-50/40 dark:hover:bg-violet-900/10
                hover:text-violet-700 dark:hover:text-violet-400 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 flex items-center justify-center shrink-0">
                <MessageSquare size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight">Falar com o Contador</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Envie uma mensagem agora</p>
              </div>
              <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-violet-400 shrink-0" />
            </Link>

            <Link href="/enviar"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10
                hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Send size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight">Enviar Vários Arquivos</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Página completa de envio</p>
              </div>
              <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-emerald-400 shrink-0" />
            </Link>
          </div>
        </aside>
      </div>

      {/* Modal */}
      {arquivoSelecionado && (
        <SectorSelectModal
          arquivo={arquivoSelecionado}
          onFechar={fecharModal}
          onSucesso={aoEnviarComSucesso}
        />
      )}
    </div>
  );
}
