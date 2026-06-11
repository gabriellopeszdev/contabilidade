import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { gerarPDF, ExportColumn } from '@/lib/exporters/pdfExporter';
import { gerarExcel } from '@/lib/exporters/excelExporter';
import { getPlanInfo, hasFeature, FEATURES } from '@/utils/planLimits';

const COLUNAS: ExportColumn[] = [
  { header: 'Cliente',       key: 'cliente',       width: 0.30 },
  { header: 'Valor',         key: 'valor',         width: 0.12 },
  { header: 'Vencimento',    key: 'vencimento',    width: 0.15 },
  { header: 'Status',        key: 'status',        width: 0.13 },
  { header: 'Mês Referência',key: 'mesReferencia', width: 0.15 },
  { header: 'Emitido em',    key: 'createdAt',     width: 0.15 },
];

export const GET = withAuth(async (req, ctx, auth) => {
  const plan = await getPlanInfo(auth.sub);
  if (!hasFeature(plan, FEATURES.RELATORIOS)) {
    return NextResponse.json(
      { message: 'Relatórios não estão disponíveis no seu plano. Faça upgrade para o Plano Pro ou superior.' },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const format = searchParams.get('format') ?? 'pdf';
  const de     = searchParams.get('de');
  const ate    = searchParams.get('ate');

  const boletos = await prisma.boletoHonorario.findMany({
    where: {
      escritorioId: auth.sub,
      ...(de || ate ? {
        createdAt: {
          ...(de ? { gte: new Date(de) } : {}),
          ...(ate ? { lte: new Date(ate + 'T23:59:59') } : {}),
        }
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 1001,
    select: { valor: true, vencimento: true, status: true, mesReferencia: true, createdAt: true, cliente: { select: { name: true } } },
  });

  const truncado = boletos.length > 1000;
  if (truncado) boletos.splice(1000);

  const linhas = boletos.map((b) => ({
    cliente:       b.cliente.name,
    valor:         `R$ ${Number(b.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    vencimento:    new Date(b.vencimento).toLocaleDateString('pt-BR'),
    status:        b.status,
    mesReferencia: b.mesReferencia,
    createdAt:     new Date(b.createdAt).toLocaleDateString('pt-BR'),
  }));

  if (format === 'json') {
    return NextResponse.json({ total: linhas.length, truncado, dados: linhas });
  }

  if (format === 'excel') {
    const buffer = await gerarExcel({ titulo: 'Relatório Financeiro', planilha: 'Financeiro', colunas: COLUNAS, linhas });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="financeiro.xlsx"',
        ...(truncado ? { 'X-Truncado': 'true' } : {}),
      },
    });
  }

  const bytes = await gerarPDF({ titulo: 'Relatório Financeiro', colunas: COLUNAS, linhas });
  return new NextResponse(bytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="financeiro.pdf"', ...(truncado ? { 'X-Truncado': 'true' } : {}) },
  });
}, ['ACCOUNTANT', 'ADMIN']);
