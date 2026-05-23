/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==========================================================================
  // Servidor customizado (server.ts)
  //
  // Ao usar um servidor customizado, o Next.js NÃO inicia o seu próprio
  // servidor HTTP — o controle é cedido ao server.ts via app.getRequestHandler().
  // Por isso NÃO usar output: 'standalone' nem output: 'export'.
  // ==========================================================================

  experimental: {
    // Pacotes que contêm código nativo do Node.js (bindings C++, módulos net/fs)
    // não devem ser bundlados pelo webpack — precisam ser resolvidos em runtime.
    serverComponentsExternalPackages: [
      '@prisma/client',
      'ioredis',
      'minio',
      'socket.io',
      'bullmq',
      'pino', 
      'pino-pretty',
    ],
  },

  // Cabeçalhos de segurança básicos para um SaaS self-hosted
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY'    },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
