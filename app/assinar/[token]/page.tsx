'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, ShieldCheck, XCircle, FileText,
  Building2, Clock, Lock, CheckCircle2, AlertTriangle, Mail, KeyRound,
  PenLine, RotateCcw, Move, ZoomIn, ArrowLeft,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssinaturaInfo {
  nomeDocumento:  string;
  signatarioNome: string;
  expiresAt:      string;
  provider:       'INTERNO' | 'DOCSEAL';
  linkExterno:    string | null;
  pdfUrl:         string | null;
}

interface Placement {
  page:     number;
  xPct:     number;
  yPct:     number;
  widthPct: number;
}

interface RenderedPage {
  dataUrl: string;
}

type Passo =
  | 'carregando'
  | 'solicitar_otp'
  | 'aguardar_otp'
  | 'desenhar'
  | 'posicionar'
  | 'assinar'
  | 'loading_sign'
  | 'assinado'
  | 'recusado'
  | 'erro';

// ── Terminal screens ───────────────────────────────────────────────────────────

function TelaErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={36} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Link inválido</h1>
        <p className="text-gray-500 text-sm leading-relaxed">{mensagem}</p>
        <p className="mt-4 text-xs text-gray-400">Entre em contato com seu escritório contábil.</p>
      </div>
    </div>
  );
}

function TelaSucesso({ nome }: { nome: string }) {
  const [segundos, setSegundos] = useState(5);

  useEffect(() => {
    if (segundos <= 0) { window.location.href = '/documentos'; return; }
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  const circunferencia = 2 * Math.PI * 20;
  const progresso      = (segundos / 5) * circunferencia;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-sm">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={44} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Assinado com sucesso!</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          <strong>{nome}</strong>, sua assinatura foi registrada com validade eletrônica.
          O documento assinado foi gerado e seu escritório foi notificado.
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left space-y-2 mb-6">
          {[
            'Assinatura manuscrita digitalizada',
            'Identidade verificada por e-mail (OTP)',
            'Nome registrado no PDF',
            'Data e hora anotadas',
            'IP de origem registrado',
            'Hash SHA-256 preservado',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="#10b981" strokeWidth="3"
                strokeDasharray={circunferencia} strokeDashoffset={circunferencia - progresso}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-emerald-600">{segundos}</span>
          </div>
          <p className="text-xs text-gray-400">Redirecionando em {segundos}s…</p>
          <button onClick={() => { window.location.href = '/documentos'; }} className="text-xs text-blue-600 hover:underline">Ir agora</button>
        </div>
      </div>
    </div>
  );
}

function TelaRecusado() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <XCircle size={36} className="text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-700 mb-2">Assinatura recusada</h1>
        <p className="text-gray-500 text-sm">O escritório contábil foi notificado da recusa.</p>
      </div>
    </div>
  );
}

// ── SignaturePad ───────────────────────────────────────────────────────────────

function SignaturePad({ onConfirm }: { onConfirm: (dataUrl: string) => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const isDrawing  = useRef(false);
  const pts        = useRef<{ x: number; y: number }[]>([]);

  function relPos(
    e:      React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ) {
    const rect = canvas.getBoundingClientRect();
    const sx   = canvas.width  / rect.width;
    const sy   = canvas.height / rect.height;
    const src  = 'touches' in e ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const p = relPos(e, canvas);
    isDrawing.current = true;
    pts.current = [p];
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const p      = relPos(e, canvas);
    const arr    = pts.current;
    arr.push(p);

    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = '#1e3a5f';

    if (arr.length >= 3) {
      const l    = arr.length;
      const mid1 = { x: (arr[l - 3].x + arr[l - 2].x) / 2, y: (arr[l - 3].y + arr[l - 2].y) / 2 };
      const mid2 = { x: (arr[l - 2].x + arr[l - 1].x) / 2, y: (arr[l - 2].y + arr[l - 1].y) / 2 };
      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(arr[l - 2].x, arr[l - 2].y, mid2.x, mid2.y);
      ctx.stroke();
    } else if (arr.length === 2) {
      ctx.beginPath();
      ctx.moveTo(arr[0].x, arr[0].y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    setHasDrawn(true);
  }

  function end(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawing.current = false;
    pts.current = [];
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function confirm() {
    const canvas = canvasRef.current!;
    // Flatten onto white background so PDF embedding looks correct
    const tmp   = document.createElement('canvas');
    tmp.width   = canvas.width;
    tmp.height  = canvas.height;
    const tctx  = tmp.getContext('2d')!;
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(canvas, 0, 0);
    onConfirm(tmp.toDataURL('image/png'));
  }

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={700}
          height={220}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white cursor-crosshair touch-none"
          style={{ aspectRatio: '700 / 220' }}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
            <PenLine size={22} className="text-slate-200" />
            <p className="text-slate-300 text-sm select-none">Assine aqui</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={clear}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={14} /> Limpar
        </button>
        <button
          onClick={confirm}
          disabled={!hasDrawn}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

// ── PdfPositioner ──────────────────────────────────────────────────────────────

function PdfPositioner({
  token,
  signatureDataUrl,
  onConfirm,
  onBack,
}: {
  token:            string;
  signatureDataUrl: string;
  onConfirm:        (placement: Placement | null) => void;
  onBack:           () => void;
}) {
  const [pages,        setPages]     = useState<RenderedPage[]>([]);
  const [loading,      setLoading]   = useState(true);
  const [loadError,    setLoadError] = useState(false);
  const [selectedPage, setSelPage]   = useState<number | null>(null);
  const [pos,          setPos]       = useState<{ xPct: number; yPct: number } | null>(null);
  const [widthPct,     setWidthPct]  = useState(0.32);

  const SIG_ASPECT = 700 / 220;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc =
          `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjs.getDocument({ url: `/api/v1/assinatura/${token}/pdf` }).promise;
        const rendered: RenderedPage[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page     = await pdf.getPage(i);
          const vp1      = page.getViewport({ scale: 1 });
          const scale    = Math.min(2.0, 800 / vp1.width);
          const viewport = page.getViewport({ scale });

          const canvas   = document.createElement('canvas');
          canvas.width   = Math.round(viewport.width);
          canvas.height  = Math.round(viewport.height);

          await page.render({ canvas, viewport }).promise;
          rendered.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
        }

        if (!cancelled) setPages(rendered);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>, pageIdx: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelPage(pageIdx);
    setPos({
      xPct: (e.clientX - rect.left) / rect.width,
      yPct: (e.clientY - rect.top)  / rect.height,
    });
  }

  const currentPlacement: Placement | null =
    selectedPage !== null && pos !== null
      ? { page: selectedPage, xPct: pos.xPct, yPct: pos.yPct, widthPct }
      : null;

  // ── Fallback when PDF.js cannot render ──────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <AlertTriangle size={32} className="text-amber-400 mx-auto" />
          <p className="text-sm text-gray-600">
            Não foi possível carregar o visualizador.<br />Escolha onde colocar a assinatura:
          </p>
          <button
            onClick={() => onConfirm({ page: 999, xPct: 0.5, yPct: 0.82, widthPct: 0.4 })}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold"
          >
            Colocar no final do documento
          </button>
          <button
            onClick={() => onConfirm(null)}
            className="w-full border border-slate-300 text-slate-600 py-3 rounded-xl text-sm"
          >
            Criar nova página com a assinatura
          </button>
          <button onClick={onBack} className="text-xs text-slate-400 hover:underline">← Refazer assinatura</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">Etapa 2 de 3</p>
          <p className="text-sm font-semibold text-gray-800">Posicionar assinatura</p>
        </div>
        <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
          <img src={signatureDataUrl} alt="Sua assinatura" className="h-7 object-contain" style={{ maxWidth: 90 }} />
        </div>
      </header>

      {/* Controls */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <Move size={13} className="text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700 flex-1">Clique no documento para posicionar</p>
        <ZoomIn size={13} className="text-slate-400 shrink-0" />
        <input
          type="range"
          min={15}
          max={60}
          value={Math.round(widthPct * 100)}
          onChange={(e) => setWidthPct(Number(e.target.value) / 100)}
          className="w-24 shrink-0"
        />
      </div>

      {/* PDF pages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-xs text-slate-400">Carregando documento...</p>
          </div>
        ) : pages.map((page, idx) => (
          <div key={idx}>
            <p className="text-[10px] text-slate-400 mb-1 font-semibold tracking-wide">
              PÁGINA {idx + 1}
            </p>
            <div
              className="relative cursor-crosshair rounded-xl overflow-hidden shadow border border-slate-200 select-none"
              onClick={(e) => handleClick(e, idx)}
            >
              <img
                src={page.dataUrl}
                alt={`Página ${idx + 1}`}
                className="w-full block"
                draggable={false}
              />

              {/* Signature preview at selected position */}
              {selectedPage === idx && pos !== null && (
                <div
                  className="absolute pointer-events-none border-2 border-blue-500 rounded bg-white/50 shadow"
                  style={{
                    left:        `${pos.xPct * 100}%`,
                    top:         `${pos.yPct * 100}%`,
                    width:       `${widthPct * 100}%`,
                    aspectRatio: `${SIG_ASPECT}`,
                    transform:   'translate(-50%, -50%)',
                  }}
                >
                  <img src={signatureDataUrl} alt="preview" className="w-full h-full object-contain" />
                </div>
              )}

              {/* Dim non-selected pages */}
              {selectedPage !== null && selectedPage !== idx && (
                <div className="absolute inset-0 bg-slate-500/25 pointer-events-none" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="bg-white border-t border-slate-200 p-4 space-y-2 shrink-0">
        {currentPlacement && (
          <p className="text-xs text-blue-600 text-center">
            Assinatura posicionada na página {currentPlacement.page + 1}
          </p>
        )}
        <button
          onClick={() => onConfirm(loading ? null : currentPlacement)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {currentPlacement
            ? <><CheckCircle2 size={15} /> Confirmar posição</>
            : <><CheckCircle2 size={15} /> {loading ? 'Aguardando...' : 'Colocar no final do documento'}</>
          }
        </button>
        <button
          onClick={() => onConfirm(null)}
          className="w-full text-slate-400 hover:text-slate-600 text-xs py-2 transition-colors"
        >
          + Criar nova página com a assinatura
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssinarPage() {
  const { token } = useParams<{ token: string }>();

  const [info,          setInfo]      = useState<AssinaturaInfo | null>(null);
  const [passo,         setPasso]     = useState<Passo>('carregando');
  const [erroMsg,       setErroMsg]   = useState('');

  // OTP
  const [maskedEmail,   setMasked]    = useState('');
  const [otp,           setOtp]       = useState('');
  const [enviandoOtp,   setEnviando]  = useState(false);
  const [verificando,   setVerif]     = useState(false);
  const [erroOtp,       setErroOtp]   = useState('');
  const [cooldown,      setCooldown]  = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  // Signature drawing & placement
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [placement,        setPlacement]        = useState<Placement | null>(null);

  // Signing form
  const [nomeAssinante, setNome]      = useState('');
  const [motivoRecusa,  setMotivo]    = useState('');
  const [recusando,     setRecusando] = useState(false);
  const [aceito,        setAceito]    = useState(false);
  const [erroForm,      setErroForm]  = useState('');
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    fetch(`/api/v1/assinatura/${token}`)
      .then((r) => r.json())
      .then((d: AssinaturaInfo & { message?: string }) => {
        if (d.message && !d.nomeDocumento) { setErroMsg(d.message); setPasso('erro'); return; }
        if (d.provider === 'DOCSEAL' && d.linkExterno) { window.location.replace(d.linkExterno); return; }
        setInfo(d);
        setNome(d.signatarioNome);
        setPasso('solicitar_otp');
      })
      .catch(() => { setErroMsg('Erro ao carregar. Verifique sua conexão.'); setPasso('erro'); });
  }, [token]);

  async function enviarOtp() {
    setEnviando(true);
    setErroOtp('');
    try {
      const r = await fetch(`/api/v1/assinatura/${token}/otp`, { method: 'POST' });
      const d = await r.json() as { maskedEmail?: string; message?: string };
      if (!r.ok) { setErroOtp(d.message ?? 'Erro ao enviar código.'); return; }
      setMasked(d.maskedEmail ?? '');
      setPasso('aguardar_otp');
      setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 100);
    } finally {
      setEnviando(false);
    }
  }

  async function verificarOtp() {
    setErroOtp('');
    if (!/^\d{6}$/.test(otp)) { setErroOtp('Digite os 6 dígitos do código.'); return; }
    setVerif(true);
    try {
      const r = await fetch(`/api/v1/assinatura/${token}/otp/verificar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ otp }),
      });
      const d = await r.json() as { ok?: boolean; message?: string };
      if (!r.ok) { setErroOtp(d.message ?? 'Código incorreto.'); setOtp(''); otpRef.current?.focus(); return; }
      setPasso('desenhar');
    } finally {
      setVerif(false);
    }
  }

  function handleSignatureDrawn(dataUrl: string) {
    setSignatureDataUrl(dataUrl);
    // Skip positioning for non-PDF documents
    if (info?.pdfUrl) {
      setPasso('posicionar');
    } else {
      setPlacement(null);
      setPasso('assinar');
    }
  }

  function handlePlacementConfirmed(p: Placement | null) {
    setPlacement(p);
    setPasso('assinar');
  }

  async function assinar() {
    setErroForm('');
    if (nomeAssinante.trim().length < 3) { setErroForm('Informe seu nome completo.'); nomeRef.current?.focus(); return; }
    if (!aceito) { setErroForm('Confirme que leu e concorda com o documento.'); return; }
    setPasso('loading_sign');
    const r = await fetch(`/api/v1/assinatura/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        confirmacao:      true,
        nomeAssinante:    nomeAssinante.trim(),
        signatureDataUrl: signatureDataUrl ?? undefined,
        placement:        placement ?? undefined,
      }),
    });
    if (r.ok) { setPasso('assinado'); return; }
    const d = await r.json().catch(() => ({})) as { message?: string };
    setErroForm(d.message ?? 'Erro ao processar. Tente novamente.');
    setPasso('assinar');
  }

  async function recusar() {
    setPasso('loading_sign');
    await fetch(`/api/v1/assinatura/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirmacao: false, motivoRecusa: motivoRecusa.trim() || undefined }),
    });
    setPasso('recusado');
  }

  // ── Terminal states ───────────────────────────────────────────────────────
  if (passo === 'erro')     return <TelaErro mensagem={erroMsg} />;
  if (passo === 'assinado') return <TelaSucesso nome={nomeAssinante} />;
  if (passo === 'recusado') return <TelaRecusado />;

  if (passo === 'carregando') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto">
          <Building2 size={28} className="text-white" />
        </div>
        <Loader2 size={20} className="animate-spin text-blue-500 mx-auto" />
        <p className="text-sm text-gray-400">Carregando documento...</p>
      </div>
    </div>
  );

  const expiresDate = info
    ? new Date(info.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  // ── Passo 1 — Solicitar OTP ───────────────────────────────────────────────
  if (passo === 'solicitar_otp') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Building2 size={26} className="text-white" />
          </div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">FiscoHub · Assinatura Eletrônica</p>
          <h1 className="text-xl font-bold text-gray-900">Verificar identidade</h1>
          <p className="text-sm text-gray-500 mt-1">Para assinar, confirme seu acesso por e-mail</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Documento</p>
            <p className="font-semibold text-sm text-gray-800 truncate">{info?.nomeDocumento}</p>
            <div className="flex items-center gap-1 mt-2">
              <Clock size={11} className="text-amber-500" />
              <p className="text-xs text-amber-600">Expira {expiresDate}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
            <Mail size={20} className="text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-700">
              Enviaremos um código de 6 dígitos para o e-mail cadastrado para verificar sua identidade.
            </p>
          </div>

          {erroOtp && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{erroOtp}</p>
            </div>
          )}

          <button
            onClick={enviarOtp}
            disabled={enviandoOtp}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {enviandoOtp
              ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
              : <><Mail size={15} /> Enviar código por e-mail</>
            }
          </button>
        </div>
      </div>
    </div>
  );

  // ── Passo 2 — Inserir OTP ─────────────────────────────────────────────────
  if (passo === 'aguardar_otp') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <KeyRound size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Digite o código</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enviamos um código para <strong>{maskedEmail}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Código de 6 dígitos
            </label>
            <input
              ref={otpRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setErroOtp(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') verificarOtp(); }}
              placeholder="000000"
              className="w-full border-2 border-slate-200 focus:border-blue-500 rounded-xl px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] focus:outline-none transition"
              disabled={verificando}
            />
            <p className="text-xs text-slate-400 text-center mt-2">Válido por 15 minutos</p>
          </div>

          {erroOtp && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{erroOtp}</p>
            </div>
          )}

          <button
            onClick={verificarOtp}
            disabled={verificando || otp.length < 6}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verificando
              ? <><Loader2 size={15} className="animate-spin" /> Verificando...</>
              : <><ShieldCheck size={15} /> Confirmar código</>
            }
          </button>

          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-xs text-slate-400">Reenviar código em {cooldown}s</p>
            ) : (
              <button
                onClick={enviarOtp}
                disabled={enviandoOtp}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {enviandoOtp ? 'Enviando...' : 'Reenviar código'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Passo 3 — Desenhar assinatura ─────────────────────────────────────────
  if (passo === 'desenhar') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <PenLine size={22} className="text-white" />
          </div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Etapa 1 de 3</p>
          <h1 className="text-xl font-bold text-gray-900">Desenhe sua assinatura</h1>
          <p className="text-sm text-gray-500 mt-1">Use o mouse ou o dedo para assinar no campo abaixo</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SignaturePad onConfirm={handleSignatureDrawn} />

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
            <span>Identidade verificada · {info?.signatarioNome}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Passo 4 — Posicionar no PDF ───────────────────────────────────────────
  if (passo === 'posicionar') return (
    <PdfPositioner
      token={token}
      signatureDataUrl={signatureDataUrl!}
      onConfirm={handlePlacementConfirmed}
      onBack={() => setPasso('desenhar')}
    />
  );

  // ── Passo 5 — Revisar e assinar ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">Etapa 3 de 3 · FiscoHub</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{info?.nomeDocumento}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 shrink-0">
          <ShieldCheck size={11} className="text-emerald-600" />
          <span className="text-[11px] text-emerald-700 font-medium">Verificado</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden" style={{ minHeight: 'calc(100vh - 57px)' }}>
        {/* PDF viewer */}
        <div className="flex-1 bg-slate-200 min-h-[55vw] lg:min-h-0 flex flex-col relative">
          {info?.pdfUrl ? (
            <iframe src={info.pdfUrl} className="absolute inset-0 w-full h-full border-0" title={info.nomeDocumento} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-300 flex items-center justify-center">
                <FileText size={28} className="text-slate-500" />
              </div>
              <p className="text-sm">{info?.nomeDocumento}</p>
            </div>
          )}
        </div>

        {/* Signing panel */}
        <aside className="w-full lg:w-[340px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shadow-xl lg:shadow-none">
          {!recusando ? (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">Identidade verificada</p>
                    <p className="text-xs text-emerald-600">{info?.signatarioNome}</p>
                  </div>
                </div>

                {/* Drawn signature preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Sua assinatura
                    </label>
                    <button
                      onClick={() => setPasso('desenhar')}
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw size={10} /> Refazer
                    </button>
                  </div>
                  {signatureDataUrl ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <img src={signatureDataUrl} alt="Sua assinatura" className="w-full h-16 object-contain" />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 h-16 flex items-center justify-center">
                      <span className="text-slate-300 text-sm italic">Sem assinatura</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    {placement
                      ? `Posicionada na página ${placement.page === 999 ? 'final' : placement.page + 1}`
                      : 'Será adicionada em nova página'
                    }
                  </p>
                </div>

                {/* Legal name */}
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nome completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="nome"
                    ref={nomeRef}
                    type="text"
                    value={nomeAssinante}
                    onChange={(e) => { setNome(e.target.value); setErroForm(''); }}
                    placeholder="Digite seu nome completo"
                    disabled={passo === 'loading_sign'}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aceito}
                    onChange={(e) => { setAceito(e.target.checked); setErroForm(''); }}
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                    disabled={passo === 'loading_sign'}
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    Declaro que li e concordo com o conteúdo do documento. Esta assinatura eletrônica tem validade jurídica (Lei nº 14.063/2020).
                  </span>
                </label>

                {erroForm && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">{erroForm}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Lock,         label: 'Criptografado' },
                    { icon: ShieldCheck,  label: 'Validade legal' },
                    { icon: Clock,        label: 'Timestamped' },
                    { icon: CheckCircle2, label: 'Hash SHA-256' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                      <Icon size={12} className="text-blue-500 shrink-0" />
                      <span className="text-[11px] text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 space-y-2.5">
                <button
                  onClick={assinar}
                  disabled={passo === 'loading_sign'}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {passo === 'loading_sign'
                    ? <><Loader2 size={15} className="animate-spin" /> Processando...</>
                    : <><ShieldCheck size={15} /> Assinar Documento</>
                  }
                </button>
                <button
                  onClick={() => { setRecusando(true); setErroForm(''); }}
                  disabled={passo === 'loading_sign'}
                  className="w-full py-2.5 rounded-xl text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Não quero assinar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 p-5 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Recusar assinatura</h2>
                  <p className="text-xs text-slate-400 mt-1">Seu escritório será notificado. Informe o motivo se desejar.</p>
                </div>
                <textarea
                  value={motivoRecusa}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo da recusa (opcional)..."
                  rows={5}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
              <div className="p-4 border-t border-slate-100 space-y-2.5">
                <button
                  onClick={recusar}
                  disabled={passo === 'loading_sign'}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {passo === 'loading_sign'
                    ? <><Loader2 size={15} className="animate-spin" /> Processando...</>
                    : <><XCircle size={15} /> Confirmar Recusa</>
                  }
                </button>
                <button onClick={() => setRecusando(false)} className="w-full py-2.5 rounded-xl text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                  Voltar
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
