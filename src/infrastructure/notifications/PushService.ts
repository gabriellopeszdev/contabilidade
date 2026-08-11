import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';
import type { ILogger } from '../../domain/ports/ILogger';

export interface PayloadPush {
  title: string;
  body:  string;
  url?:  string;
}

function vapidConfigurado(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configurarVapid() {
  if (!vapidConfigurado()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_APP_URL || 'mailto:noreply@localhost',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export class PushService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: ILogger,
  ) {}

  chavePublica(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  async enviarParaUsuario(userId: string, payload: PayloadPush): Promise<void> {
    if (!configurarVapid()) return;
    const subs = await this.db.inscricaoPush.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      url:   payload.url || '/dashboard',
    });

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.db.inscricaoPush.deleteMany({ where: { endpoint: s.endpoint } });
        } else {
          this.logger.warn('[PushService] Falha ao enviar', {
            err: err instanceof Error ? err.message : err,
          });
        }
      }
    }));
  }
}
