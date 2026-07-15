import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { Redis }        from 'ioredis';
import { REDIS_DOMAIN_EVENTS_CHANNEL } from '../infrastructure/events/RedisEventDispatcher';

export async function enviarAvisoAdmin(
  titulo:   string,
  mensagem: string,
  db:       PrismaClient,
  redis:    Redis,
): Promise<number> {
  const contadores = await db.usuarioContador.findMany({
    where:  { isActive: true, deletedAt: null, isAdmin: false },
    select: { id: true },
  });

  if (contadores.length === 0) return 0;

  const notificacoes = contadores.map((c) => ({
    id:       randomUUID(),
    userId:   c.id,
    userType: 'CONTADOR',
    tipo:     'AVISO_ADMIN',
    titulo,
    mensagem,
  }));

  await db.notificacao.createMany({ data: notificacoes });

  await redis.publish(
    REDIS_DOMAIN_EVENTS_CHANNEL,
    JSON.stringify({
      eventName:    'AvisoAdminEvent',
      eventId:      randomUUID(),
      occurredAt:   new Date().toISOString(),
      notificacoes: notificacoes.map((n) => ({ contadorId: n.userId, notifId: n.id })),
      titulo,
      mensagem,
    }),
  );

  return contadores.length;
}
