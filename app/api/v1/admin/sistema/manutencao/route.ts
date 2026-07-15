import { NextResponse } from 'next/server';
import { withAuth }       from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }         from '../../../../../../src/infrastructure/di/Container';
import { redisPublisher } from '../../../../../../src/infrastructure/di/Container';
import { enviarAvisoAdmin } from '../../../../../../src/utils/enviarAvisoAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withAuth(async (req, _ctx, _auth) => {
  let ativa: boolean;
  try {
    const body = await req.json() as { ativa?: unknown };
    if (typeof body.ativa !== 'boolean') {
      return NextResponse.json({ message: 'Campo "ativa" é obrigatório (boolean).' }, { status: 400 });
    }
    ativa = body.ativa;
  } catch {
    return NextResponse.json({ message: 'Body inválido.' }, { status: 400 });
  }

  const config = await prisma.configuracaoSistema.upsert({
    where:  { id: 'system' },
    create: { id: 'system', manutencaoAtiva: ativa },
    update: { manutencaoAtiva: ativa },
    select: { manutencaoAtiva: true },
  });

  // Ao ativar manutenção, envia aviso em massa para todos os contadores
  if (ativa) {
    void enviarAvisoAdmin(
      'Sistema em Manutenção',
      'O FiscoHub entrará em manutenção em breve. Salve seu trabalho. Serviço restabelecido em breve.',
      prisma,
      redisPublisher,
    );
  }

  return NextResponse.json({ ativa: config.manutencaoAtiva });
}, ['ADMIN']);
