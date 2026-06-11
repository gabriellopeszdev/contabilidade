import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma }   from '@/infrastructure/di/Container';

export const GET = withAuth(async (req: NextRequest, _ctx, auth) => {
  const q     = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const setor = req.nextUrl.searchParams.get('setor')?.trim() ?? '';
  const tipo  = req.nextUrl.searchParams.get('tipo')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ documentos: [], clientes: [], obrigacoes: [] });
  }

  const like = { contains: q, mode: 'insensitive' as const };

  // Get contadorId's client IDs for scoping document search
  const clienteIds = (await prisma.contadorCliente.findMany({
    where: { contadorId: auth.sub },
    select: { clienteId: true },
  })).map((r) => r.clienteId);

  const [documentos, clientes, obrigacoes] = await Promise.all([
    // Documents belonging to this contador's clients
    // competencia is a DateTime field — not searchable via string contains
    prisma.documentoFiscal.findMany({
      where: {
        deletedAt: null,
        clientId: { in: clienteIds },
        ...(setor ? { sector: setor as 'FISCAL' | 'PESSOAL' | 'CONTABIL' } : {}),
        ...(tipo  ? { fileType: tipo as 'PDF' | 'XML' | 'XLSX' | 'XLS' | 'DOCX' | 'DOC' | 'CSV' | 'OFX' | 'ODS' } : {}),
        OR: [
          { fileName: like },
        ],
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        sector: true,
        createdAt: true,
        cliente: { select: { name: true } },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),

    // Clients — relation field in schema is contadoresRel (ContadorCliente[])
    prisma.usuarioCliente.findMany({
      where: {
        deletedAt: null,
        contadoresRel: { some: { contadorId: auth.sub } },
        OR: [
          { name:  like },
          { email: like },
          { cnpj:  like },
        ],
      },
      select: { id: true, name: true, email: true, cnpj: true, isActive: true },
      take: 10,
      orderBy: { name: 'asc' },
    }),

    // Fiscal obligations — no deletedAt field on ObrigacaoFiscal
    prisma.obrigacaoFiscal.findMany({
      where: {
        contadorId: auth.sub,
        OR: [
          { nome:     like },
          { descricao: like },
        ],
      },
      select: { id: true, nome: true, descricao: true, recorrencia: true },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    documentos: documentos.map((d) => ({
      id:        d.id,
      fileName:  d.fileName,
      fileType:  d.fileType,
      sector:    d.sector,
      cliente:   d.cliente?.name ?? '',
      createdAt: new Date(d.createdAt).toLocaleDateString('pt-BR'),
    })),
    clientes: clientes.map((c) => ({
      id:       c.id,
      name:     c.name,
      email:    c.email,
      cnpj:     c.cnpj,
      isActive: c.isActive,
    })),
    obrigacoes: obrigacoes.map((o) => ({
      id:        o.id,
      nome:      o.nome,
      descricao: o.descricao ?? '',
      tipo:      o.recorrencia ?? '',
    })),
  });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
