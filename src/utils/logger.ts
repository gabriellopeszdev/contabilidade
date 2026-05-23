// =============================================================================
// src/utils/logger.ts — Atalho para o Logger estruturado do Container
//
// Re-exporta o singleton PinoLogger do Composition Root, proporcionando um
// import curto para Route Handlers e demais módulos server-side:
//
//   import { logger } from '@/src/utils/logger';
//   logger.error('[POST /rota] Falha', err);
//
// O PinoLogger já inclui:
//   - Redação automática de campos sensíveis (senha, token, authorization)
//   - Nível debug silenciado em produção
//   - JSON estruturado em produção / pino-pretty em desenvolvimento
//   - Serialização de Error com stack trace
// =============================================================================

export { logger } from '../infrastructure/di/Container';
