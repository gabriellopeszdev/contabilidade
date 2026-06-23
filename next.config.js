/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist optionally imports 'canvas' (native Node.js binding) — alias
    // it to false so webpack doesn't try to bundle it in the browser bundle.
    config.resolve.alias.canvas = false;
    return config;
  },
  // ==========================================================================
  // Servidor customizado (server.ts)
  //
  // Ao usar um servidor customizado, o Next.js NÃO inicia o seu próprio
  // servidor HTTP — o controle é cedido ao server.ts via app.getRequestHandler().
  // Por isso NÃO usar output: 'standalone' nem output: 'export'.
  // ==========================================================================

  // Pacotes que contêm código nativo do Node.js (bindings C++, módulos net/fs)
  // não devem ser bundlados pelo webpack — precisam ser resolvidos em runtime.
  // Movido de experimental.serverComponentsExternalPackages (Next.js 14) para
  // serverExternalPackages (Next.js 15/16).
  // Permite HMR via ngrok/túneis em dev (não tem efeito em produção)
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io', '*.ngrok-free.dev'],

  turbopack: {},

  experimental: {
    optimizeCss: true,
  },

  serverExternalPackages: [
    '@prisma/client',
    'ioredis',
    'minio',
    'socket.io',
    'bullmq',
    'pino',
    'pino-pretty',
  ],

  // Cabeçalhos de segurança básicos para um SaaS self-hosted
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      // Cache imutável de 1 ano só em produção — em dev o Next.js precisa controlar
      // esse header para o HMR funcionar corretamente.
      ...(isProd ? [{
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      }] : []),
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY'    },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' ws: wss:",
              "frame-src 'self'",
              "worker-src 'self' blob: https://unpkg.com",
              "manifest-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
