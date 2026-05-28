import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { gerarPDF, ExportColumn } from '@/lib/exporters/pdfExporter';
import { gerarExcel } from '@/lib/exporters/excelExporter';

const COLUNAS: ExportColumn[] = [
  { header: 'Nome',     key: 'name',       width: 0.25 },
  { header: 'CNPJ',     key: 'cnpj',       width: 0.15 },
  { header: 'Email',    key: 'email',      width: 0.25 },
  { header: 'Telefone', key: 'phone',      width: 0.12 },
  { header: 'Ativo',    key: 'ativo',      width: 0.08 },
  { header: 'Desde',    key: 'assignedAt', width: 0.15 },
];

export const GET = withAuth(async (req, ctx, auth) => {
  const { searchParams } = req.nextUrl;
  const format = searchParams.get('format') ?? 'pdf';
  const de     = searchParams.get('de');
  const ate    = searchParams.get('ate');

  const relacoes = await prisma.contadorCliente.findMany({
    where: {
      contadorId: auth.sub,
      ...(de || ate ? {
        assignedAt: {
          ...(de ? { gte: new Date(de) } : {}),
          ...(ate ? { lte: new Date(ate + 'T23:59:59') } : {}),
        }
      } : {}),
    },
    orderBy: { assignedAt: 'desc' },
    take: 5000,
    select: { assignedAt: true, cliente: { select: { name: true, cnpj: true, email: true, phone: true, isActive: true } } },
  });

  const linhas = relacoes.map((r) => ({
    name:       r.cliente.name,
    cnpj:       r.cliente.cnpj,
    email:      r.cliente.email,
    phone:      r.cliente.phone ?? '-',
    ativo:      r.cliente.isActive ? 'Sim' : 'Não',
    assignedAt: new Date(r.assignedAt).toLocaleDateString('pt-BR'),
  }));

  if (format === 'json') {
    return NextResponse.json({ total: linhas.length, dados: linhas });
  }

  if (format === 'excel') {
    const buffer = await gerarExcel({ titulo: 'Carteira de Clientes', planilha: 'Clientes', colunas: COLUNAS, linhas });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="clientes.xlsx"',
      },
    });
  }

  const bytes = await gerarPDF({ titulo: 'Carteira de Clientes', colunas: COLUNAS, linhas });
  return new NextResponse(bytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="clientes.pdf"' },
  });
}, ['ACCOUNTANT', 'ADMIN']);
