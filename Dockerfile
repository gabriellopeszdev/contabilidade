# =============================================================================
# Dockerfile — Sistema de Gestão Contábil
#
# Multi-stage build:
#   Stage 1 (builder): instala deps, gera Prisma Client, faz next build
#                       + compila server.ts (esbuild) para dist/server.js
#   Stage 2 (runner):  imagem final com apenas deps de produção
#
# NOTA: server.ts roda como dist/server.js (JS já compilado) — sem tsx em
#       runtime, evitando o overhead de transpilação TS a cada início/import.
# =============================================================================

# =============================================================================
# Stage 1 — Build
# =============================================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

# npm 10.8.2 (bundled com node:20) tem bug no arborist ("Cannot read
# properties of null (reading 'edgesOut')") ao resolver este lockfile
# com overrides. Atualiza o npm antes do install para evitar o bug.
RUN npm install -g npm@11

WORKDIR /app

# Manifesto de dependências primeiro (cache de layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Instala todas as deps (inclui devDeps: tsx, prisma CLI, typescript)
RUN npm install --frozen-lockfile

# Gera o Prisma Client
RUN npx prisma generate

# Copia o restante do código-fonte
COPY . .

# NEXT_PUBLIC_* são embutidos no bundle em build time — passar como ARG
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

ARG NEXT_PUBLIC_ASAAS_ENV=sandbox
ENV NEXT_PUBLIC_ASAAS_ENV=$NEXT_PUBLIC_ASAAS_ENV

# Build do Next.js (gera .next/)
ENV NODE_ENV=production
RUN npm run build

# =============================================================================
# Stage 2 — Runner (imagem de produção)
# =============================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl curl

# Mesmo bug do arborist do npm 10.8.2 mencionado no stage builder.
RUN npm install -g npm@11

WORKDIR /app

ENV NODE_ENV=production

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Instala as deps (--omit=dev bate em bug do npm arborist com este lockfile;
# mantém instalação completa como antes — só o start deixou de usar tsx)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --frozen-lockfile && npm cache clean --force

# Gera o Prisma Client na imagem final
RUN npx prisma generate

# Copia o build do Next.js gerado no stage anterior
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Copia o server.ts já compilado (dist/server.js) — nada de TS em runtime
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --chown=nextjs:nodejs app        ./app
COPY --chown=nextjs:nodejs public     ./public

# Copia arquivos de configuração necessários em runtime
COPY --chown=nextjs:nodejs next.config.js       .
COPY --chown=nextjs:nodejs tailwind.config.ts   .
COPY --chown=nextjs:nodejs postcss.config.js    .
COPY --chown=nextjs:nodejs prisma.config.ts     .
COPY --chown=nextjs:nodejs docker-entrypoint.sh .

USER root
RUN chmod +x /app/docker-entrypoint.sh
USER nextjs

EXPOSE 4500

ENTRYPOINT ["/app/docker-entrypoint.sh"]
