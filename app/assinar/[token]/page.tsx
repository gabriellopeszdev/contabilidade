'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams }                   from 'next/navigation';
import {
  Loader2, ShieldCheck, XCircle, FileText,
  Building2, Clock, Lock, CheckCircle2, AlertTriangle, Mail, KeyRound,
} from 'lucide-react';

interface AssinaturaInfo {
  nomeDocumento:  string;
  signatarioNome: string;
  expiresAt:      string;
  provider:       'INTERNO' | 'DOCSEAL';
  linkExterno:    string | null;
  pdfUrl:         string | null;
}

type Passo = 'carregando' | 'solicitar_otp' | 'aguardar_otp' | 'assinar' | 'loading_sign' | 'assinado' | 'recusado' | 'erro';

// ── Tela de erro ─────────────────────────────────────────────────────────────
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

// ── Tela de sucesso com countdown ────────────────────────────────────────────
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
          {['Identidade verificada por e-mail (OTP)', 'Nome registrado no PDF', 'Data e hora anotadas', 'IP de origem registrado', 'Hash SHA-256 preservado'].map((item) => (
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

// ── Tela de recusa ────────────────────────────────────────────────────────────
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

// ── Página principal ──────────────────────────────────────────────────────────
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

  // Assinatura
  const [nomeAssinante, setNome]      = useState('');
  const [motivoRecusa,  setMotivo]    = useState('');
  const [recusando,     setRecusando] = useState(false);
  const [aceito,        setAceito]    = useState(false);
  const [erroForm,      setErroForm]  = useState('');
  const nomeRef = useRef<HTMLInputElement>(null);

  // Cooldown de reenvio
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
      setPasso('assinar');
    } finally {
      setVerif(false);
    }
  }

  async function assinar() {
    setErroForm('');
    if (nomeAssinante.trim().length < 3) { setErroForm('Informe seu nome completo.'); nomeRef.current?.focus(); return; }
    if (!aceito) { setErroForm('Confirme que leu e concorda com o documento.'); return; }
    setPasso('loading_sign');
    const r = await fetch(`/api/v1/assinatura/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirmacao: true, nomeAssinante: nomeAssinante.trim() }),
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

  // ── Estados terminais ─────────────────────────────────────────────────────
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

  const expiresDate = info ? new Date(info.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

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
            {enviandoOtp ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : <><Mail size={15} /> Enviar código por e-mail</>}
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
            {verificando ? <><Loader2 size={15} className="animate-spin" /> Verificando...</> : <><ShieldCheck size={15} /> Confirmar código</>}
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

  // ── Passo 3 — Assinar ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">FiscoHub · Assinatura Eletrônica</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{info?.nomeDocumento}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 shrink-0">
          <ShieldCheck size={11} className="text-emerald-600" />
          <span className="text-[11px] text-emerald-700 font-medium">Identidade verificada</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden" style={{ minHeight: 'calc(100vh - 57px)' }}>
        {/* PDF */}
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

        {/* Painel */}
        <aside className="w-full lg:w-[340px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shadow-xl lg:shadow-none">
          {!recusando ? (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">Identidade verificada</p>
                    <p className="text-xs text-emerald-600">{info?.signatarioNome}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Prévia da assinatura
                  </label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 px-4 py-3 min-h-[56px] flex items-center">
                    {nomeAssinante.trim() ? (
                      <span className="text-blue-700 text-xl leading-snug" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                        {nomeAssinante.trim()}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm italic">Sua assinatura aparecerá aqui</span>
                    )}
                  </div>
                </div>

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
