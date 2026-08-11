export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0a0f1e] text-white">
      <p className="text-lg font-bold">Sem conexão</p>
      <p className="text-sm text-slate-400 max-w-sm">
        O FiscoHub precisa de internet para carregar o painel, documentos e o chat.
      </p>
      <a
        href="/dashboard"
        className="min-h-[44px] inline-flex items-center justify-center px-4 rounded-lg bg-primary text-white text-sm font-semibold"
      >
        Tentar de novo
      </a>
    </div>
  );
}
