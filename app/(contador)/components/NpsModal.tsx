'use client';
import { useState, useEffect } from 'react';

export function NpsModal() {
  const [exibir, setExibir]       = useState(false);
  const [score, setScore]         = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado]     = useState(false);

  useEffect(() => {
    fetch('/api/v1/nps')
      .then((r) => r.json())
      .then((d: { exibir?: boolean }) => { if (d.exibir) setExibir(true); })
      .catch(() => {/* ignore */});
  }, []);

  if (!exibir || enviado) return null;

  async function enviar() {
    if (score === null) return;
    await fetch('/api/v1/nps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comentario }),
    });
    setEnviado(true);
    setTimeout(() => setExibir(false), 2000);
  }

  const labelScore = score === null ? '' : score <= 6 ? 'Detrator' : score <= 8 ? 'Neutro' : 'Promotor';
  const corLabel   = score === null ? '' : score <= 6 ? 'text-red-500' : score <= 8 ? 'text-yellow-500' : 'text-green-600';

  return (
    <div className="fixed bottom-6 left-6 w-96 max-w-[calc(100vw-3rem)] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 p-6 space-y-4">
      <button
        onClick={() => setExibir(false)}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
      >
        &times;
      </button>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Como você avalia o Konto?</h3>
        <p className="text-sm text-gray-400 mt-0.5">De 0 a 10, qual a probabilidade de indicar para um colega?</p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => setScore(i)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
              score === i
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      {score !== null && <p className={`text-sm text-center font-medium ${corLabel}`}>{labelScore}</p>}
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentário opcional..."
        rows={2}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      />
      <button
        onClick={enviar}
        disabled={score === null}
        className="w-full bg-primary text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-primary-dark transition-colors"
      >
        Enviar feedback
      </button>
    </div>
  );
}
