'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            minHeight:      '100vh',
            fontFamily:     'system-ui, sans-serif',
            padding:        '2rem',
            textAlign:      'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Algo deu errado
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Ocorreu um erro inesperado. Nossa equipe já foi notificada.
          </p>
          <button
            onClick={reset}
            style={{
              padding:      '0.5rem 1.5rem',
              background:   '#7c3aed',
              color:        '#fff',
              border:       'none',
              borderRadius: '0.5rem',
              cursor:       'pointer',
              fontSize:     '0.875rem',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
