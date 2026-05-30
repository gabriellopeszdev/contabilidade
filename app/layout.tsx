import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '../src/presentation/context/AuthContext';
import { LGPDConsentGuard } from './components/LGPDConsentGuard';

// =============================================================================
// Metadados globais da aplicação
//
// O template "%s | FiscoHub" é aplicado automaticamente a todas
// as páginas que exportam seu próprio `metadata.title` como string.
// =============================================================================

export const metadata: Metadata = {
  title: {
    template: '%s | FiscoHub',
    default:  'FiscoHub',
  },
  description:
    'FiscoHub — Gestão fiscal inteligente para escritórios modernos. ' +
    'Automação fiscal, assinatura eletrônica, chat em tempo real e integração bancária.',
  // Em produção: adicionar metadados Open Graph para compartilhamento
  // openGraph: { ... }
};

// =============================================================================
// Layout Raiz — Server Component
//
// Renderiza o <html> e <body> exigidos pelo Next.js App Router.
// O AuthProvider é um Client Component mas pode ser importado aqui —
// o Next.js injeta o contexto apenas no cliente.
//
// NOTA: NÃO importar next/font/google aqui pois o servidor self-hosted
// pode não ter acesso a fonts.googleapis.com. Usa-se o font-stack do sistema
// definido em globals.css.
// =============================================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        {/*
          AuthProvider envolve toda a árvore para que qualquer componente
          acesse o estado de autenticação via useAuth().
        */}
        <AuthProvider>
          {children}
          <LGPDConsentGuard />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
