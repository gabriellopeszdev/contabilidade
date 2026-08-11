import type { PrismaClient } from '@prisma/client';
import type { ILogger } from '../../domain/ports/ILogger';
import { PushService } from './PushService';

function urlPorTipo(tipo: string): string {
  if (tipo === 'CHAT') return '/chat';
  if (tipo === 'BOLETO' || tipo === 'FINANCEIRO') return '/financeiro';
  if (tipo === 'NFE' || tipo === 'DOCUMENTO') return '/nfe';
  return '/dashboard';
}

export interface CriarNotificacaoInput {
  userId:     string;
  userType:   'CONTADOR' | 'CLIENTE';
  tipo:       string;
  titulo:     string;
  mensagem:   string;
  metadados?: Record<string, unknown>;
}

export class NotificacaoService {
  private readonly push: PushService;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: ILogger,
  ) {
    this.push = new PushService(db, logger);
  }

  async criar(input: CriarNotificacaoInput): Promise<string | null> {
    try {
      const notif = await this.db.notificacao.create({
        data: {
          userId:    input.userId,
          userType:  input.userType,
          tipo:      input.tipo,
          titulo:    input.titulo,
          mensagem:  input.mensagem,
          metadados: input.metadados ? (input.metadados as object) : undefined,
        },
      });
      void this.push.enviarParaUsuario(input.userId, {
        title: input.titulo,
        body:  input.mensagem,
        url:   urlPorTipo(input.tipo),
      });
      return notif.id;
    } catch (err) {
      this.logger.error('[NotificacaoService] Falha ao persistir', err instanceof Error ? err : { err });
      return null;
    }
  }

  async contarNaoLidas(userId: string): Promise<number> {
    return this.db.notificacao.count({ where: { userId, lida: false } });
  }
}
