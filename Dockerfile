# =============================================================================
# Dockerfile — Sistema de Gestão Contábil
#
# Multi-stage build:
#   Stage 1 (builder): instala deps, gera Prisma Client, faz next build
#   Stage 2 (runner):  imagem final com apenas o necessário para produção
#
# NOTA: tsx está em devDependencies e é necessário em runtime (server.ts).
#       Por isso instala-se todas as deps na imagem final também.
# =============================================================================

# =============================================================================
# Stage 1 — Build
# =============================================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Manifesto de dependências primeiro (cache de layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Instala todas as deps (inclui devDeps: tsx, prisma CLI, typescript)
RUN npm ci

# Gera o Prisma Client
RUN npx prisma generate

# Copia o restante do código-fonte
COPY . .

# Build do Next.js (gera .next/)
ENV NODE_ENV=production
RUN npm run build

# =============================================================================
# Stage 2 — Runner (imagem de produção)
# =============================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Reinstala deps na imagem final (tsx é necessário em runtime)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npm cache clean --force

# Gera o Prisma Client na imagem final
RUN npx prisma generate

# Copia o build do Next.js gerado no stage anterior
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Copia o código-fonte (tsx executa server.ts diretamente em runtime)
COPY --chown=nextjs:nodejs src        ./src
COPY --chown=nextjs:nodejs app        ./app

# Copia arquivos de configuração necessários em runtime
COPY --chown=nextjs:nodejs server.ts       .
COPY --chown=nextjs:nodejs next.config.js  .
COPY --chown=nextjs:nodejs tsconfig.json   .
COPY --chown=nextjs:nodejs tailwind.config.ts  .
COPY --chown=nextjs:nodejs postcss.config.js   .

USER nextjs

EXPOSE 3000

# npm start → tsx server.ts (conforme package.json)
CMD ["npm", "start"]
